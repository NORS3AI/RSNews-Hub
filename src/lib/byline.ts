// Byline resolution — pure, no DB. Decides what a reader sees as the author of
// an article, from (in priority order): a chosen library byline (a saved person
// with photo + title), a free-text one-off name, or the generic team default.
//
// The "RS News Hub Team" default is deliberately NOT a database row: it's what
// shows whenever an article has no byline attached, so a brand-new article reads
// as the house byline with zero setup. Editors only ever attach a real person
// when they want a named, pictured byline.

export const TEAM_BYLINE_NAME = 'RS News Hub Team';

// A library byline as needed for rendering (fetched via the select below).
export type BylineRef = { id: string; name: string; title: string | null; photo: string | null };

// The live values an in-article Author card pulls from its linked byline.
export type BylineCard = { name: string; title: string; avatar: string; bio: string };

// What the reader byline component renders. `photo`/`title` are null for the
// team default and for a free-text one-off name.
export type ResolvedByline = { name: string; title: string | null; photo: string | null; isTeam: boolean };

// The Prisma select for a byline wherever an article's byline is rendered.
export const bylineRefSelect = { id: true, name: true, title: true, photo: true } as const;

// Extract the byline ids that in-article Author cards link to, from article HTML
// (a `<div data-author data-bylineid="...">`). Pure string scan — the caller
// fetches the current library values so an edit propagates to every placed card.
export function bylineIdsInContent(html: string | null | undefined): string[] {
  if (!html) return [];
  const out = new Set<string>();
  const re = /data-bylineid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) { const id = m[1].trim(); if (id) out.add(id); }
  return [...out];
}

// Choose the reader-facing byline. A library byline (with a real name) wins;
// else a typed one-off name (name only); else the house team default.
export function resolveByline(
  ref: BylineRef | null | undefined,
  freeText: string | null | undefined,
): ResolvedByline {
  if (ref && ref.name.trim()) {
    return { name: ref.name.trim(), title: ref.title?.trim() || null, photo: ref.photo?.trim() || null, isTeam: false };
  }
  const t = (freeText ?? '').trim();
  if (t) return { name: t, title: null, photo: null, isTeam: false };
  return { name: TEAM_BYLINE_NAME, title: null, photo: null, isTeam: true };
}

// Initials for the avatar fallback when a byline has no photo (max 2 letters).
export function bylineInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}
