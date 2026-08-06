// One shared vocabulary for "what state is this thing in", used by the Recent
// Activity page and the individual admin lists so a poll, article, quiz or module
// all read the same way:
//   draft     — never published (yellow)
//   scheduled — will go live at a future date (blue)
//   live      — public right now (green)
//   ended     — was live, now retired / expired / archived (gray)
//
// Pure (no framework) — the chip styling lives in components/admin/StatusChip.

import { parseTree } from './studio';

export type LifeStatus = 'draft' | 'scheduled' | 'live' | 'ended';

export const STATUS_LABEL: Record<LifeStatus, string> = {
  draft: 'Draft', scheduled: 'Scheduled', live: 'Live', ended: 'Ended',
};

const asTime = (d: Date | string | null | undefined): number | null => {
  if (!d) return null;
  const t = typeof d === 'string' ? Date.parse(d) : d.getTime();
  return Number.isNaN(t) ? null : t;
};

/** Article: DRAFT → draft; PUBLISHED with a future date → scheduled, else live;
 *  ARCHIVED/TRASHED → ended. */
export function articleStatus(a: { status: string; publishedAt: Date | string | null }, now: number): LifeStatus {
  if (a.status === 'DRAFT') return 'draft';
  if (a.status === 'ARCHIVED' || a.status === 'TRASHED') return 'ended';
  if (a.status === 'PUBLISHED') {
    const at = asTime(a.publishedAt);
    return at !== null && at > now ? 'scheduled' : 'live';
  }
  return 'ended';
}

/** Poll/quiz: active + still open → live; active but past its close → ended;
 *  inactive → ended (retired to the archive). No native draft/scheduled state. */
export function timedStatus(t: { active: boolean; closesAt: Date | string | null }, now: number): LifeStatus {
  if (!t.active) return 'ended';
  const closes = asTime(t.closesAt);
  return closes !== null && closes <= now ? 'ended' : 'live';
}

/** Custom module: unpublished → draft; published & expired → ended; published but
 *  every element is gated to a future start → scheduled; otherwise live. */
export function moduleStatus(m: { published: boolean; expiresAt: Date | string | null; tree: string }, now: number): LifeStatus {
  if (!m.published) return 'draft';
  const exp = asTime(m.expiresAt);
  if (exp !== null && exp <= now) return 'ended';
  const kids = parseTree(m.tree).children;
  if (kids.length > 0 && kids.every((b) => b.startAt && (asTime(b.startAt) ?? 0) > now)) return 'scheduled';
  return 'live';
}
