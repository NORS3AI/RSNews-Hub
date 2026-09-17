// Server-side "dissect a link" helper for the Industry News quick-add.
// Fetches a URL and pulls the headline, source and publish date out of the
// page's Open Graph / meta tags, so an editor pastes ONE link and the rest
// fills itself in. Best-effort: anything it can't find is left blank.
//
// SSRF: an editor (lower-trust than admin) supplies this URL, so the fetch is
// routed through safeFetch — it resolves the host and refuses any private/
// reserved address, and re-validates every redirect hop, so a link can't point
// the server at cloud metadata (169.254.169.254) or an internal service.

import { safeFetch, SsrfError } from './ssrf';

export type LinkMeta = {
  url: string;
  title: string;
  source: string;
  description: string;
  publishedAt: string | null; // ISO
  host: string;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pull a <meta> content by property/name, tolerating attribute order.
function meta(html: string, key: string): string {
  const k = escRe(key);
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*\\scontent=["']([^"']*)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, 'i'));
  return a?.[1] ? decodeEntities(a[1]) : b?.[1] ? decodeEntities(b[1]) : '';
}

function firstMeta(html: string, keys: string[]): string {
  for (const k of keys) { const v = meta(html, k); if (v) return v; }
  return '';
}

function titleTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/\s+/g, ' ')) : '';
}

function prettyHost(host: string): string {
  const h = host.replace(/^www\./, '');
  const base = h.split('.')[0] || h;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function fetchLinkMeta(rawUrl: string): Promise<LinkMeta | { error: string }> {
  let u: URL;
  try { u = new URL(rawUrl.trim()); } catch { return { error: 'That doesn\'t look like a valid URL.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Only http(s) links are supported.' };
  if (!u.hostname.includes('.')) return { error: 'That doesn\'t look like a public web address.' };

  let html = '';
  try {
    const res = await safeFetch(u.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSNewsHubBot/1.0; +news-hub)', Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return { error: `Couldn't open that page (HTTP ${res.status}). You can still fill it in by hand.` };
    // Only the <head> matters; cap the read so a huge page can't stall us.
    html = (await res.text()).slice(0, 400_000);
  } catch (e) {
    // A blocked private/internal target reads the same to the editor as any
    // unreachable link — we don't confirm what's on the internal network.
    if (e instanceof SsrfError) return { error: "That link points somewhere we can't fetch. Paste a public news URL." };
    return { error: "Couldn't reach that page. Check the link, or fill the fields in by hand." };
  }

  const title = firstMeta(html, ['og:title', 'twitter:title']) || titleTag(html);
  const source = firstMeta(html, ['og:site_name', 'application-name']) || prettyHost(u.hostname);
  const description = firstMeta(html, ['og:description', 'twitter:description', 'description']);
  const dateRaw = firstMeta(html, ['article:published_time', 'og:article:published_time', 'article:modified_time', 'og:updated_time', 'date', 'publish-date', 'pubdate']);
  let publishedAt: string | null = null;
  if (dateRaw) { const d = new Date(dateRaw); if (!isNaN(d.getTime())) publishedAt = d.toISOString(); }

  return { url: u.toString(), title, source, description, publishedAt, host: u.hostname };
}
