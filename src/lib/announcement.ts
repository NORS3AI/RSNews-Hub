// Announcement bar — a reusable LIBRARY of saved messages plus two independent
// switches held in Setting rows:
//   • announcement:enabled — the master on/off for the whole bar
//   • announcement:liveId   — which saved message is currently shown
// Saving/editing a message (upsertAnnouncement) NEVER touches those, so "save"
// only edits the library; "on/off" and "show this one" are separate actions.
// Pure signature helper so dismissal can be keyed on both client and server.

import { prisma } from './db';
import { canViewContent, type AccountLike } from './entitlements';

const ENABLED_KEY = 'announcement:enabled';
const LIVE_KEY = 'announcement:liveId';

export type AnnSize = 'sm' | 'md' | 'lg';
export type AnnElement = 'message' | 'countdown' | 'button';
const ELEMENTS: AnnElement[] = ['message', 'countdown', 'button'];

export type AnnouncementRecord = {
  id: string;
  name: string;
  message: string;
  href: string;
  hrefLabel: string;
  targetAt: string | null;   // ISO instant, or null
  showCountdown: boolean;
  size: AnnSize;
  ticker: boolean;
  order: AnnElement[];        // the render order of the three elements
  audience: string;           // entitlement gate: '' = everyone; else a token
  starred: boolean;
};

const clampStr = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const asSize = (v: unknown): AnnSize => (v === 'sm' || v === 'lg' ? v : 'md');
function normTarget(v: unknown): Date | null {
  if (typeof v === 'string' && v.trim()) { const d = new Date(v); if (!isNaN(d.getTime())) return d; }
  return null;
}

/** Parse a stored/submitted "message,countdown,button" order into a complete,
 *  deduped list — unknown tokens dropped, any missing element appended. */
export function parseOrder(raw: string | null | undefined): AnnElement[] {
  const parts = String(raw ?? '').split(',').map((s) => s.trim()).filter((s): s is AnnElement => (ELEMENTS as string[]).includes(s));
  const seen = new Set<AnnElement>();
  const out: AnnElement[] = [];
  for (const p of parts) if (!seen.has(p)) { seen.add(p); out.push(p); }
  for (const e of ELEMENTS) if (!seen.has(e)) out.push(e);
  return out;
}

type Row = {
  id: string; name: string; message: string; href: string; hrefLabel: string;
  targetAt: Date | null; showCountdown: boolean; size: string; ticker: boolean; order: string; audience: string; starred: boolean;
};
function toRecord(r: Row): AnnouncementRecord {
  return {
    id: r.id, name: r.name, message: r.message, href: r.href, hrefLabel: r.hrefLabel,
    targetAt: r.targetAt ? r.targetAt.toISOString() : null,
    showCountdown: r.showCountdown && !!r.targetAt,
    size: asSize(r.size), ticker: r.ticker, order: parseOrder(r.order), audience: r.audience, starred: r.starred,
  };
}

/** Signature of the *visible* content — changes when the admin edits it, so a
 *  reader who dismissed the old one sees the new. Includes the id so switching
 *  which message is live also re-shows. */
export function announcementSignature(r: AnnouncementRecord): string {
  return [r.id, r.message, r.href, r.hrefLabel, r.targetAt ?? '', r.showCountdown ? '1' : '0', r.size, r.ticker ? '1' : '0', r.order.join('')].join('|');
}

async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? '';
}
async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export type AnnouncementInput = {
  id?: string; name?: string; message?: string; href?: string; hrefLabel?: string;
  targetAt?: string | null; showCountdown?: boolean; size?: string; ticker?: boolean; order?: string; audience?: string;
};

// The gate token is a lower-case key ('' = everyone). Kept short + normalized so
// only a sane value ever reaches canViewContent.
const asAudience = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 40) : '');

/** The whole library, starred first then most-recently-edited. */
export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  const rows = await prisma.announcement.findMany({ orderBy: [{ starred: 'desc' }, { updatedAt: 'desc' }] });
  return rows.map(toRecord);
}

/** Create or update a library message. Does NOT change on/off or which is live. */
export async function upsertAnnouncement(input: AnnouncementInput): Promise<string> {
  const targetAt = normTarget(input.targetAt);
  const data = {
    name: clampStr(input.name, 80),
    message: clampStr(input.message, 200),
    href: clampStr(input.href, 500),
    hrefLabel: clampStr(input.hrefLabel, 40),
    targetAt,
    showCountdown: !!input.showCountdown && !!targetAt,
    size: asSize(input.size),
    ticker: !!input.ticker,
    order: parseOrder(input.order).join(','),
    audience: asAudience(input.audience),
  };
  if (input.id) return (await prisma.announcement.update({ where: { id: input.id }, data, select: { id: true } })).id;
  return (await prisma.announcement.create({ data, select: { id: true } })).id;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await prisma.announcement.deleteMany({ where: { id } });
  if ((await getSetting(LIVE_KEY)) === id) await setSetting(LIVE_KEY, ''); // clear if it was live
}

export async function toggleStar(id: string): Promise<void> {
  const row = await prisma.announcement.findUnique({ where: { id }, select: { starred: true } });
  if (row) await prisma.announcement.update({ where: { id }, data: { starred: !row.starred } });
}

/** Choose which saved message the bar shows (independent of on/off). */
export async function setLiveAnnouncement(id: string): Promise<void> { await setSetting(LIVE_KEY, id); }
/** The master on/off for the whole bar (independent of which message is live). */
export async function setAnnouncementEnabled(on: boolean): Promise<void> { await setSetting(ENABLED_KEY, on ? 'true' : 'false'); }

export async function getAnnouncementState(): Promise<{ enabled: boolean; liveId: string }> {
  const [enabled, liveId] = await Promise.all([getSetting(ENABLED_KEY), getSetting(LIVE_KEY)]);
  return { enabled: enabled === 'true', liveId };
}

/** The message the reader bar should show `viewer` right now, or null (off, none
 *  chosen, or the live message is gated to an audience this viewer isn't in).
 *  Gating is enforced HERE, server-side, so a bar the viewer can't see is never
 *  sent to their browser. */
export async function getLiveAnnouncement(viewer: AccountLike | null = null): Promise<AnnouncementRecord | null> {
  const { enabled, liveId } = await getAnnouncementState();
  if (!enabled || !liveId) return null;
  const row = await prisma.announcement.findUnique({ where: { id: liveId } });
  if (!row || !row.message) return null;
  if (!canViewContent(viewer, row.audience)) return null;
  return toRecord(row);
}
