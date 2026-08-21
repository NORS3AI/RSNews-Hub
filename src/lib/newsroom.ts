// Pure helpers for the Newsroom (the shared drafts space). No DB, no React — just
// the small logic the server actions and the client workspace both rely on, so it
// stays testable and can't drift between the two.

import { isLikelyHeading, withAutoAds, type ImportBlock } from './simpleImport';

/** A staffer is "present" on a doc if their heartbeat is this fresh. */
export const PRESENCE_ACTIVE_MS = 30_000;
/** Heartbeat rows older than this are pruned (the staffer has long since left). */
export const PRESENCE_STALE_MS = 5 * 60_000;
/** How often the client heartbeats / re-syncs presence + comments. */
export const HEARTBEAT_MS = 7_000;
/** Debounce between a keystroke and an autosave (a couple of seconds). */
export const AUTOSAVE_MS = 1_400;

export type NewsroomCommentView = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;        // ISO
  quote: string | null;       // the passage the note is anchored to (if any)
  quoteStart: number | null;  // its character offset in the body when written
};

/** Locate a note's anchored passage in the current body. Prefers the stored
 *  offset, then falls back to a text search (the draft may have shifted since).
 *  Returns the [start, end) range, or null if the passage is gone. Pure so the
 *  editor and tests agree on the jump target. */
export function locateQuote(body: string, quote: string | null, quoteStart: number | null): { start: number; end: number } | null {
  const q = (quote ?? '').trim();
  if (!q) return null;
  if (quoteStart != null && quoteStart >= 0 && body.slice(quoteStart, quoteStart + q.length) === q) {
    return { start: quoteStart, end: quoteStart + q.length };
  }
  const i = body.indexOf(q);
  return i >= 0 ? { start: i, end: i + q.length } : null;
}

// A row in the Newsroom list — no body, so the directory stays light with dozens
// of drafts. Full bodies load only when a draft is opened.
export type NewsroomDocSummary = {
  id: string;
  title: string;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
  commentCount: number;
  flaggedByMe: boolean; // is this draft pinned by the current staffer?
};

// A draft the current staffer has pinned, for the editor's quick-switcher rail.
export type NewsroomFlaggedDraft = { id: string; title: string; updatedAt: string };

// The full doc as the single-doc editor holds it (body + comment thread). The sync
// loop returns this one doc so a co-editor's changes and notes show up live.
export type NewsroomDocView = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;        // ISO
  updatedById: string | null;
  updatedByName: string | null;
  createdByName: string | null;
  comments: NewsroomCommentView[];
};

export type NewsroomViewer = {
  userId: string;
  userName: string;
  editing: boolean;
};

/** Whether a heartbeat `lastSeen` counts as currently present. */
export function isPresenceActive(lastSeen: Date | string, now: number): boolean {
  const t = new Date(lastSeen).getTime();
  return Number.isFinite(t) && now - t <= PRESENCE_ACTIVE_MS;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Convert a plain-prose Newsroom body into the article composer's HTML: blank
 * lines separate paragraphs, single newlines become <br>. Text is escaped (the
 * body is prose, never markup), then the composer's own sanitizer runs on save.
 * Empty/whitespace-only input yields ''.
 */
export function docBodyToArticleHtml(body: string): string {
  const text = (body ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/**
 * Split a prose body into typed blocks: each blank-line-separated chunk is a
 * paragraph, unless it's a short single line that reads like a sub-heading (same
 * heuristic the paste importer uses), in which case it's a heading. Shared logic
 * means a story drafted in the Newsroom lands in the composer with the SAME
 * structure a pasted story would — sub-heads detected, not one flat wall of text.
 */
export function docBodyToBlocks(body: string): ImportBlock[] {
  const text = (body ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (!b.includes('\n') && isLikelyHeading(b) ? { kind: 'h' as const, text: b } : { kind: 'p' as const, text: b }));
}

/** Serialize push blocks to composer HTML, preserving intra-paragraph line breaks
 *  as <br> (blocksToHtml in simpleImport drops them; the Newsroom wants them kept). */
export function docBlocksToArticleHtml(blocks: ImportBlock[]): string {
  return blocks
    .map((b) => {
      if (b.kind === 'ad') {
        const size = b.size === 'rectangle' ? 'rectangle' : 'wide';
        return `<div data-ad-slot="" data-ad-brand="" data-ad-size="${size}" data-ad-label=""></div>`;
      }
      const text = escapeHtml(b.text || '').replace(/\n/g, '<br>');
      return b.kind === 'h' ? `<h2>${text}</h2>` : `<p>${text}</p>`;
    })
    .join('\n');
}

/**
 * The full push transform a Newsroom draft goes through on its way to the article
 * composer: detect sub-headings, then auto-place ad slots at the ⅓/⅔ marks — the
 * same structured HTML the "paste an article" importer produces. Empty in → ''.
 */
export function docBodyToStructuredHtml(body: string): string {
  const blocks = docBodyToBlocks(body);
  if (!blocks.length) return '';
  return docBlocksToArticleHtml(withAutoAds(blocks));
}

/** A short single-line preview of a doc body for the tab strip / list. */
export function docPreview(body: string, max = 90): string {
  const flat = (body ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Draft a starter title from the first line of the body when the doc is still
 *  "Untitled" — so a tab gets a meaningful name without the writer titling it. */
export function deriveDocTitle(body: string, fallback = 'Untitled draft'): string {
  const firstLine = (body ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).find(Boolean);
  if (!firstLine) return fallback;
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}
