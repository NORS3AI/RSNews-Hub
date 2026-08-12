// Server-side per-account saved state: favorites + to-read (articles) and
// clippings. Signed-in members get these stored in the DB so they follow the
// account across devices; the client keeps a local cache and merges any
// pre-login local items on first sign-in. Client input is always normalized
// here — never trusted verbatim.

import { prisma } from './db';

export type SavedItem = { id: string; title: string; slug: string; folder?: string | null };
export type Clipping = {
  id: string; ts: number; title: string;
  kind?: 'quote' | 'comic'; quote?: string; author?: string | null; slug?: string; image?: string | null;
};
export type FavFolder = { id: string; name: string };
export type SavedBundle = { favorites: SavedItem[]; toRead: SavedItem[]; clippings: Clipping[]; folders: FavFolder[] };

const FOLDER_MAX = 40; // per-account cap on favorite folders
const FOLDER_NAME_MAX = 32;

const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const sOrNull = (v: unknown, max: number): string | null => { const t = s(v, max); return t ? t : null; };

/** Validate a favorite/to-read item from the client, or null if unusable. Pure. */
export function normalizeSavedItem(raw: unknown): SavedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id, 64).trim();
  if (!id) return null;
  return { id, title: s(r.title, 300).trim() || 'Untitled', slug: s(r.slug, 300).trim(), folder: sOrNull(r.folder, 64) };
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
  const [items, clips, folders] = await Promise.all([
    prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.clipping.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: CLIP_MAX }),
    prisma.favoriteFolder.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
  ]);
  // Favorites carry their folder id; to-read never does.
  const favorites = items.filter((i) => i.kind === 'favorite').map((i) => ({ id: i.articleId, title: i.title, slug: i.slug, folder: i.folderId }));
  const toRead = items.filter((i) => i.kind === 'toread').map((i) => ({ id: i.articleId, title: i.title, slug: i.slug }));
  return {
    favorites,
    toRead,
    folders,
    clippings: clips.map((c) => ({ id: c.clientId, ts: c.createdAt.getTime(), title: c.title, kind: c.kind as 'quote' | 'comic', quote: c.quote ?? undefined, author: c.author, slug: c.slug ?? undefined, image: c.image })),
  };
}

// ---- writes (all return the fresh bundle) ----

async function toggle(userId: string, kind: 'favorite' | 'toread', item: SavedItem) {
  const where = { userId_kind_articleId: { userId, kind, articleId: item.id } };
  const existing = await prisma.savedItem.findUnique({ where });
  // Idempotent on both sides so a second tab/device toggling the same article
  // concurrently doesn't 500: deleteMany no-ops on an already-removed row, and a
  // duplicate create (both tabs saw "not saved") is swallowed as already-saved.
  if (existing) {
    await prisma.savedItem.deleteMany({ where: { userId, kind, articleId: item.id } });
  } else {
    try {
      await prisma.savedItem.create({ data: { userId, kind, articleId: item.id, title: item.title, slug: item.slug } });
    } catch (e: unknown) {
      if (!(e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002')) throw e;
    }
  }
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

// ---- favorite folders ----

export async function addFavFolder(userId: string, name: string) {
  const clean = s(name, FOLDER_NAME_MAX).trim();
  if (clean) {
    const count = await prisma.favoriteFolder.count({ where: { userId } });
    if (count < FOLDER_MAX) await prisma.favoriteFolder.create({ data: { userId, name: clean } });
  }
  return getSaved(userId);
}

export async function renameFavFolder(userId: string, folderId: string, name: string) {
  const clean = s(name, FOLDER_NAME_MAX).trim();
  // Scope the update by userId so one member can't rename another's folder.
  if (clean && folderId) await prisma.favoriteFolder.updateMany({ where: { id: folderId, userId }, data: { name: clean } });
  return getSaved(userId);
}

export async function removeFavFolder(userId: string, folderId: string) {
  // onDelete: SetNull unfiles the favorites that lived in this folder.
  if (folderId) await prisma.favoriteFolder.deleteMany({ where: { id: folderId, userId } });
  return getSaved(userId);
}

/** File a favorite into a folder (or unfile with folderId=null). Ignores unknown folders/articles. */
export async function setFavFolder(userId: string, articleId: string, folderId: string | null) {
  const id = s(articleId, 64).trim();
  if (!id) return getSaved(userId);
  let target: string | null = null;
  if (folderId) {
    // Only accept a folder the member actually owns.
    const owned = await prisma.favoriteFolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
    target = owned ? owned.id : null;
  }
  await prisma.savedItem.updateMany({ where: { userId, kind: 'favorite', articleId: id }, data: { folderId: target } });
  return getSaved(userId);
}

/** One-time merge of a signed-in member's pre-login local items into their account. */
export async function mergeLocal(userId: string, local: Partial<SavedBundle>) {
  // Cap each array so a crafted request can't build an unbounded transaction.
  const cap = <T>(a: T[] | undefined) => (Array.isArray(a) ? a.slice(0, CLIP_MAX) : []);
  const favs = cap(local.favorites).map(normalizeSavedItem).filter(Boolean) as SavedItem[];
  const reads = cap(local.toRead).map(normalizeSavedItem).filter(Boolean) as SavedItem[];
  const clips = cap(local.clippings).map(normalizeClipping).filter(Boolean) as Clipping[];

  // Recreate the member's local folders on the server first, mapping each local
  // (browser-generated) id → the new server id so favorites keep their grouping.
  const localFolders = (Array.isArray(local.folders) ? local.folders.slice(0, FOLDER_MAX) : [])
    .map((f) => ({ id: s((f as FavFolder)?.id, 64).trim(), name: s((f as FavFolder)?.name, FOLDER_NAME_MAX).trim() }))
    .filter((f) => f.id && f.name);
  // One atomic transaction: reconcile the folders (mapping local id → server id),
  // then upsert the items filed into them. Folder creation is made idempotent and
  // capped: a local folder whose NAME already exists reuses that server folder
  // (so a lost-response retry or a StrictMode double-fire can't duplicate them),
  // and we never create past FOLDER_MAX total (so a crafted/replayed merge can't
  // grow folders without bound).
  await prisma.$transaction(async (tx) => {
    const idMap = new Map<string, string>();
    const existing = await tx.favoriteFolder.findMany({ where: { userId }, select: { id: true, name: true } });
    const byName = new Map(existing.map((f) => [f.name, f.id]));
    let room = FOLDER_MAX - existing.length;
    for (const f of localFolders) {
      const hit = byName.get(f.name);
      if (hit) { idMap.set(f.id, hit); continue; }
      if (room <= 0) continue;
      room--;
      const created = await tx.favoriteFolder.create({ data: { userId, name: f.name }, select: { id: true } });
      idMap.set(f.id, created.id);
      byName.set(f.name, created.id);
    }
    await Promise.all([
      ...favs.map((i) => tx.savedItem.upsert({ where: { userId_kind_articleId: { userId, kind: 'favorite', articleId: i.id } }, update: {}, create: { userId, kind: 'favorite', articleId: i.id, title: i.title, slug: i.slug, folderId: (i.folder && idMap.get(i.folder)) || null } })),
      ...reads.map((i) => tx.savedItem.upsert({ where: { userId_kind_articleId: { userId, kind: 'toread', articleId: i.id } }, update: {}, create: { userId, kind: 'toread', articleId: i.id, title: i.title, slug: i.slug } })),
      ...clips.map((c) => tx.clipping.upsert({ where: { userId_clientId: { userId, clientId: c.id } }, update: {}, create: { userId, clientId: c.id, kind: c.kind ?? 'quote', title: c.title, quote: c.quote ?? null, author: c.author ?? null, slug: c.slug ?? null, image: c.image ?? null } })),
    ]);
  });
  return getSaved(userId);
}
