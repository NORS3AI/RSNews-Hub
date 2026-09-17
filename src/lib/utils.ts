export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function estimateReadMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function makeExcerpt(content: string, len = 180): string {
  const text = stripHtml(content);
  if (text.length <= len) return text;
  return text.slice(0, len).replace(/\s+\S*$/, '') + '…';
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Like formatDate but pinned to UTC. Use for values that ARE UTC instants (e.g.
 *  report quarter boundaries like 2025-01-01T00:00Z) so a non-UTC server doesn't
 *  render them a day off (Jan 1 → "Dec 31"). */
export function formatDateUTC(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Date + time, pinned to UTC — stable across server/client render (no hydration
 *  drift). Used for review "paper trail" timestamps (when a round was sent / answered). */
export function formatDateTimeUTC(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Sanitize a user/staff-entered link for rendering in an <a href>. Allows ONLY
 * an http(s) URL or a single-slash site-relative path ("/path"); everything else
 * — javascript:/data:/vbscript: (script execution) and protocol-relative "//host"
 * (silent offsite) — collapses to `fallback`. Reused by any surface that stores a
 * link a lower-trust editor can set (announcement bar, ads, …). React does NOT
 * strip javascript: hrefs in production, so this is the guard that does.
 */
export function safeLinkHref(v: unknown, fallback = '', max = 500): string {
  const s = (typeof v === 'string' ? v.trim() : '').slice(0, max);
  if (!s) return fallback;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/(?!\/)/.test(s)) return s; // "/path" but not "//host"
  return fallback;
}
