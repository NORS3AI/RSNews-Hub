// Pure helpers for the Newsroom (the shared drafts space). No DB, no React — just
// the small logic the server actions and the client workspace both rely on, so it
// stays testable and can't drift between the two.

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
};

// The full doc as the client holds it. The drafts space is small (a handful of
// in-flight drafts), so the sync loop returns whole bodies + threads — the client
// takes the server copy for every doc except the one it's actively editing.
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
