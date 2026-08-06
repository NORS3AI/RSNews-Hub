// Server-side per-account saved state: favorites + to-read (articles) and
// clippings. Signed-in members get these stored in the DB so they follow the
// account across devices; the client keeps a local cache and merges any
// pre-login local items on first sign-in. Client input is always normalized
// here — never trusted verbatim.

import { prisma } from './db';

export type SavedItem = { id: string; title: string; slug: string };
export type Clipping = {
  id: string; ts: number; title: string;
  kind?: 'quote' | 'comic'; quote?: string; author?: string | null; slug?: string; image?: string | null;
};
export type SavedBundle = { favorites: SavedItem[]; toRead: SavedItem[]; clippings: Clipping[] };

const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const sOrNull = (v: unknown, max: number): string | null => { const t = s(v, max); return t ? t : null; };

/** Validate a favorite/to-read item from the client, or null if unusable. Pure. */
export function normalizeSavedItem(raw: unknown): SavedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id, 64).trim();
  if (!id) return null;
  return { id, title: s(r.title, 300).trim() || 'Untitled', slug: s(r.slug, 300).trim() };
}

/** Validate a clipping from the client, or null if unusable. Pure. */
export function normalizeClipping(raw: unknown): Clipping | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id, 64).trim();
  if (!id) return null;
  const kind = r.kind === 'comic' ? 'comic' : 'quote';
  return {
    id,
    ts: typeof r.ts === 'number' && isFinite(r.ts) ? r.ts : Date.now(),
    title: s(r.title, 300).trim() || 'Clipping',
    kind,
    quote: sOrNull(r.quote, 5000) ?? undefined,
    author: sOrNull(r.author, 200),
    slug: sOrNull(r.slug, 300) ?? undefined,
    image: sOrNull(r.image, 500_000), // comic image (url or data URL); capped
  };
}

const CLIP_MAX = 200; // per-account cap

// ---- reads ----

export async function getSaved(userId: string): Promise<SavedBundle> {
  const [items, clips] = await Promise.all([
    prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.clipping.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: CLIP_MAX }),
  ]);
  const pick = (kind: string) => items.filter((i) => i.kind === kind).map((i) => ({ id: i.articleId, title: i.title, slug: i.slug }));
  return {
    favorites: pick('favorite'),
    toRead: pick('toread'),
    clippings: clips.map((c) => ({ id: c.clientId, ts: c.createdAt.getTime(), title: c.title, kind: c.kind as 'quote' | 'comic', quote: c.quote ?? undefined, author: c.author, slug: c.slug ?? undefined, image: c.image })),
  };
}

// ---- writes (all return the fresh bundle) ----

async function toggle(userId: string, kind: 'favorite' | 'toread', item: SavedItem) {
  const where = { userId_kind_articleId: { userId, kind, articleId: item.id } };
  const existing = await prisma.savedItem.findUnique({ where });
  if (existing) await prisma.savedItem.delete({ where });
  else await prisma.savedItem.create({ data: { userId, kind, articleId: item.id, title: item.title, slug: item.slug } });
  return getSaved(userId);
}

export const toggleFavorite = (userId: string, item: SavedItem) => toggle(userId, 'favorite', item);
export const toggleToRead = (userId: string, item: SavedItem) => toggle(userId, 'toread', item);

export async function removeToRead(userId: string, articleId: string) {
  await prisma.savedItem.deleteMany({ where: { userId, kind: 'toread', articleId } });
  return getSaved(userId);
}

export async function clearToRead(userId: string) {
  await prisma.savedItem.deleteMany({ where: { userId, kind: 'toread' } });
  return getSaved(userId);
}

export async function addClipping(userId: string, c: Clipping) {
  await prisma.clipping.upsert({
    where: { userId_clientId: { userId, clientId: c.id } },
    update: {},
    create: { userId, clientId: c.id, kind: c.kind ?? 'quote', title: c.title, quote: c.quote ?? null, author: c.author ?? null, slug: c.slug ?? null, image: c.image ?? null },
  });
  // Enforce the per-account cap (drop oldest beyond CLIP_MAX).
  const extra = await prisma.clipping.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: CLIP_MAX, select: { id: true } });
  if (extra.length) await prisma.clipping.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
  return getSaved(userId);
}

export async function removeClipping(userId: string, clientId: string) {
  await prisma.clipping.deleteMany({ where: { userId, clientId } });
  return getSaved(userId);
}

/** One-time merge of a signed-in member's pre-login local items into their account. */
export async function mergeLocal(userId: string, local: Partial<SavedBundle>) {
  // Cap each array so a crafted request can't build an unbounded transaction.
  const cap = <T>(a: T[] | undefined) => (Array.isArray(a) ? a.slice(0, CLIP_MAX) : []);
  const favs = cap(local.favorites).map(normalizeSavedItem).filter(Boolean) as SavedItem[];
  const reads = cap(local.toRead).map(normalizeSavedItem).filter(Boolean) as SavedItem[];
  const clips = cap(local.clippings).map(normalizeClipping).filter(Boolean) as Clipping[];

  await prisma.$transaction([
    ...favs.map((i) => prisma.savedItem.upsert({ where: { userId_kind_articleId: { userId, kind: 'favorite', articleId: i.id } }, update: {}, create: { userId, kind: 'favorite', articleId: i.id, title: i.title, slug: i.slug } })),
    ...reads.map((i) => prisma.savedItem.upsert({ where: { userId_kind_articleId: { userId, kind: 'toread', articleId: i.id } }, update: {}, create: { userId, kind: 'toread', articleId: i.id, title: i.title, slug: i.slug } })),
    ...clips.map((c) => prisma.clipping.upsert({ where: { userId_clientId: { userId, clientId: c.id } }, update: {}, create: { userId, clientId: c.id, kind: c.kind ?? 'quote', title: c.title, quote: c.quote ?? null, author: c.author ?? null, slug: c.slug ?? null, image: c.image ?? null } })),
  ]);
  return getSaved(userId);
}
