// Helpers for the curated "Industry News" external-link module.

/** Display source for a link: explicit `source`, else the URL's host (no www). */
export function linkSource(url: string, source?: string | null): string {
  if (source && source.trim()) return source.trim();
  try {
    const h = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
    return h.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
  }
}

/** Truncate a source label to ~20 chars for the compact row. */
export function shortSource(s: string, n = 22): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** "Aug 4, 2:30 PM" — when we posted it. */
export function postedLabel(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
