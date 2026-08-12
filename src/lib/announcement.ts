// Site-wide announcement bar config — a single admin-controlled Setting row.
// Drives the dismissible top strip (see AnnouncementBar) and can carry a live
// countdown (e.g. "RS Expo 2026" ticking down to the date). Pure helpers so the
// signature can be computed on both server and client.

import { prisma } from './db';

const KEY = 'announcement';

export type AnnouncementConfig = {
  enabled: boolean;
  message: string;        // e.g. "RS Expo 2026 — the industry's biggest weekend"
  href: string;           // optional link (empty = no link)
  hrefLabel: string;      // e.g. "Register" (empty = "Learn more" when href set)
  targetAt: string | null; // ISO instant to count down to (null = no countdown)
  showCountdown: boolean;  // show the live countdown in the bar
};

export const EMPTY_ANNOUNCEMENT: AnnouncementConfig = {
  enabled: false, message: '', href: '', hrefLabel: '', targetAt: null, showCountdown: false,
};

/** A stable signature of the *visible* content. When it changes (new message,
 *  new date), a reader who dismissed the old one sees the new one. */
export function announcementSignature(c: AnnouncementConfig): string {
  return [c.message, c.href, c.hrefLabel, c.targetAt ?? '', c.showCountdown ? '1' : '0'].join('|');
}

/** Coerce arbitrary stored/submitted data into a valid config. */
export function normalizeAnnouncement(raw: unknown): AnnouncementConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  let targetAt: string | null = null;
  if (typeof o.targetAt === 'string' && o.targetAt.trim()) {
    const d = new Date(o.targetAt);
    if (!isNaN(d.getTime())) targetAt = d.toISOString();
  }
  return {
    enabled: !!o.enabled,
    message: str(o.message, 200),
    href: str(o.href, 500),
    hrefLabel: str(o.hrefLabel, 40),
    targetAt,
    showCountdown: !!o.showCountdown && !!targetAt,
  };
}

export async function getAnnouncement(): Promise<AnnouncementConfig> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row?.value) return EMPTY_ANNOUNCEMENT;
  try { return normalizeAnnouncement(JSON.parse(row.value)); } catch { return EMPTY_ANNOUNCEMENT; }
}

export async function setAnnouncement(cfg: AnnouncementConfig): Promise<void> {
  const value = JSON.stringify(normalizeAnnouncement(cfg));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
