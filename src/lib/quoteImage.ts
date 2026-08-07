// Client-only: paints a branded quote card onto a canvas and returns a PNG
// data URL. Used by the news-clippings feature.

export type QuoteTheme = 'dark' | 'light' | 'rs';
export type QuoteOpts = { quote: string; title?: string; author?: string | null; url?: string; slug?: string; theme?: QuoteTheme };

// Per-theme palette for the quote card. `footerBg` paints a solid band behind
// the footer (else a hairline divider). `parchment` fills the body with the RS
// stamp texture. `logo` picks which logo art reads on that footer.
type Palette = {
  bg1: string; bg2: string; accent: string; quoteMark: string; quote: string;
  bodySub: string; // muted text ON the body (for the "excerpted" note under the quote)
  footerText: string; footerSub: string; divider: string;
  logoBg: string; logoText: string; footerBg: string | null;
  logo: 'light' | 'dark'; parchment?: boolean;
};
const PALETTES: Record<QuoteTheme, Palette> = {
  dark: {
    bg1: '#2b333d', bg2: '#141a21', accent: '#E97D34', quoteMark: 'rgba(233,125,52,.92)', quote: '#f4f1ea',
    bodySub: 'rgba(244,241,234,.62)',
    footerText: '#ffffff', footerSub: 'rgba(255,255,255,.6)', divider: 'rgba(255,255,255,.16)',
    logoBg: '#E97D34', logoText: '#ffffff', footerBg: null, logo: 'dark',
  },
  light: {
    bg1: '#fbf7ee', bg2: '#efe6d4', accent: '#E97D34', quoteMark: 'rgba(233,125,52,.92)', quote: '#2b333c',
    bodySub: 'rgba(43,51,60,.6)',
    footerText: '#2b333c', footerSub: 'rgba(43,51,60,.55)', divider: 'rgba(43,51,60,.14)',
    logoBg: '#E97D34', logoText: '#ffffff', footerBg: null, logo: 'light',
  },
  rs: {
    // Cream parchment (with stamps) body; a darker slate footer with cream text.
    bg1: '#f7edd8', bg2: '#f2e6cb', accent: '#3d2a19', quoteMark: 'rgba(61,42,25,.4)', quote: '#3d2a19',
    bodySub: 'rgba(61,42,25,.66)',
    footerText: '#f7edd8', footerSub: 'rgba(247,237,216,.72)', divider: 'rgba(61,42,25,.2)',
    logoBg: '#f7edd8', logoText: '#2b333c', footerBg: '#2b333c', logo: 'dark', parchment: true,
  },
};

// Small italic note under the quote — makes clear a clip is an excerpt.
const EXCERPT_NOTE = 'Excerpted from a longer article. Read the full article for complete context. · RS News Hub';

// Branded assets painted onto the card (loaded lazily, client-only).
const LOGO_LIGHT = '/brand/rsnews-hub-logo-light.png';
const LOGO_DARK = '/brand/rsnews-hub-logo-dark.png';
const PARCHMENT = '/textures/rs-cream.webp';

const imgCache: Record<string, HTMLImageElement> = {};
function getImg(src: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  let img = imgCache[src];
  if (!img) { img = new Image(); img.src = src; imgCache[src] = img; }
  return img;
}
function ready(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}
/** Preload the logos + parchment so the next makeQuoteImage() can paint them.
 *  Resolves when all have loaded or failed (never rejects). */
export function preloadQuoteAssets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return Promise.all([LOGO_LIGHT, LOGO_DARK, PARCHMENT].map((s) => new Promise<void>((res) => {
    const img = getImg(s);
    if (!img || (img.complete && img.naturalWidth > 0)) return res();
    img.onload = () => res(); img.onerror = () => res();
  }))).then(() => undefined);
}
// Draw an image to COVER a box (crop-to-fill), centered.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight, r = w / h;
  const dw = ir > r ? h * ir : w, dh = ir > r ? h : w / ir;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function makeQuoteImage(o: QuoteOpts): string {
  const W = 1080, H = 1080, pad = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const p = PALETTES[o.theme ?? 'dark'];

  // Body: parchment texture (RS) or a theme gradient.
  const parchment = p.parchment ? getImg(PARCHMENT) : null;
  if (p.parchment && ready(parchment)) {
    ctx.fillStyle = p.bg1; ctx.fillRect(0, 0, W, H); // base under any transparency
    drawCover(ctx, parchment, 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, p.bg1); g.addColorStop(1, p.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = p.accent; ctx.fillRect(pad, pad, 96, 12);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = p.quoteMark; ctx.font = '900 200px Georgia, serif';
  ctx.fillText('“', pad - 12, pad - 8);

  // Preserve block breaks (a heading vs the paragraph below it) captured in the
  // clip so the quote reads as intended instead of running blocks together.
  let blocks = clampBlocks((o.quote || '').split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean), 340);
  if (!blocks.length) blocks = [''];
  const disp = blocks.map((b, i) => (i === 0 ? '“' + b : b) + (i === blocks.length - 1 ? '”' : ''));

  const maxW = W - pad * 2;
  // Leave a strip above the footer for the one-line italic "excerpted" note.
  const quoteTop = pad + 210, avail = (H - 378) - quoteTop;
  let size = 62, wrapped: string[][] = [], lineH = 0, blockGap = 0;
  while (size >= 26) {
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, Arial, sans-serif`;
    lineH = size * 1.3; blockGap = Math.round(size * 0.6);
    wrapped = disp.map((b) => wrap(ctx, b, maxW));
    const total = wrapped.reduce((sum, ls, i) => sum + ls.length * lineH + (i ? blockGap : 0), 0);
    if (total <= avail) break;
    size -= 3;
  }
  ctx.fillStyle = p.quote; ctx.font = `700 ${size}px ui-sans-serif, system-ui, Arial, sans-serif`;
  let y = quoteTop;
  wrapped.forEach((ls, i) => { if (i) y += blockGap; for (const ln of ls) { ctx.fillText(ln, pad, y); y += lineH; } });

  const by = H - 300;

  // "Excerpted…" note — one line (auto-shrunk to fit), small italic, muted,
  // sitting just above the footer divider.
  let ns = 23;
  const noteFont = (s: number) => `italic 500 ${s}px ui-sans-serif, system-ui, Arial, sans-serif`;
  ctx.font = noteFont(ns);
  while (ns > 15 && ctx.measureText(EXCERPT_NOTE).width > maxW) { ns -= 1; ctx.font = noteFont(ns); }
  ctx.fillStyle = p.bodySub;
  ctx.fillText(EXCERPT_NOTE, pad, by - ns - 18);
  // A solid footer band (RS) or a hairline divider.
  if (p.footerBg) {
    ctx.fillStyle = p.footerBg; ctx.fillRect(0, by, W, H - by);
  } else {
    ctx.strokeStyle = p.divider; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad, by); ctx.lineTo(W - pad, by); ctx.stroke();
  }

  // Brand: the real logo art (light/dark to suit the footer), or a drawn RS
  // mark + wordmark as a fallback while the image is still loading.
  const logo = getImg(p.logo === 'light' ? LOGO_LIGHT : LOGO_DARK);
  let urlY: number;
  if (ready(logo)) {
    const lh = 82, lw = lh * (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, pad, by + 34, lw, lh);
    urlY = by + 34 + lh + 8;
  } else {
    ctx.fillStyle = p.logoBg; roundRect(ctx, pad, by + 34, 68, 68, 15); ctx.fill();
    ctx.fillStyle = p.logoText; ctx.font = '900 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RS', pad + 34, by + 34 + 36);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = p.footerText; ctx.font = '800 32px ui-sans-serif, Arial'; ctx.fillText('RSNews Hub', pad + 86, by + 40);
    urlY = by + 78; ctx.fillStyle = p.footerSub; ctx.font = '500 24px ui-sans-serif, Arial'; ctx.fillText(o.url || '', pad + 86, urlY);
    urlY = -1; // already drawn beside the wordmark
  }
  if (urlY >= 0) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = p.footerSub; ctx.font = '500 24px ui-sans-serif, Arial'; ctx.fillText(o.url || '', pad, urlY); }

  const ty = by + 168;
  ctx.fillStyle = p.footerText; ctx.font = '800 34px ui-sans-serif, Arial';
  const titleLines = wrap(ctx, o.title || '', maxW).slice(0, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, pad, ty + i * 42));
  if (o.author) {
    ctx.fillStyle = p.footerSub; ctx.font = '500 27px ui-sans-serif, Arial';
    ctx.fillText('— ' + o.author, pad, ty + titleLines.length * 42 + 8);
  }
  return canvas.toDataURL('image/png');
}

// Trim a block list to a total character budget, keeping block boundaries and
// adding an ellipsis where it cuts off.
export function clampBlocks(blocks: string[], max: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const b of blocks) {
    if (used >= max) break;
    if (used + b.length <= max) { out.push(b); used += b.length; }
    else { out.push(b.slice(0, max - used).replace(/\s+\S*$/, '').trim() + '…'); break; }
  }
  return out;
}

// Elements that must never end up in a clip (ads and non-prose chrome).
const CLIP_SKIP_SEL = '.had, .ad, [data-ad-brand], [data-ad], figure, figcaption, .clip-hint, button, script, style, aside';
const CLIP_BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'FIGCAPTION', 'DIV', 'SECTION', 'UL', 'OL', 'PRE', 'TABLE']);

/**
 * Strip ads/chrome from a cloned fragment (or element) and turn it into clip
 * text — one line per block, so a heading never merges into the paragraph below
 * and ad copy never lands in the middle of the quote.
 */
export function fragmentToClipText(root: DocumentFragment | Element): string {
  root.querySelectorAll(CLIP_SKIP_SEL).forEach((n) => n.remove());
  return blocksToText(root);
}

// Turn a DOM fragment into text, one line per block element, so a heading does
// not run into the paragraph beneath it.
function blocksToText(root: Node): string {
  const parts: string[] = [];
  let buf = '';
  const flush = () => { const t = buf.replace(/\s+/g, ' ').trim(); if (t) parts.push(t); buf = ''; };
  const walk = (node: Node) => {
    if (node.nodeType === 3) { buf += node.nodeValue || ''; return; }
    if (node.nodeType === 11) { node.childNodes.forEach(walk); return; } // DocumentFragment
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName === 'BR') { buf += ' '; return; }
    if (CLIP_BLOCK_TAGS.has(el.tagName)) {
      flush();
      if (el.tagName === 'LI') buf = '• '; // preserve bullets in the clip
      el.childNodes.forEach(walk);
      flush();
    } else { el.childNodes.forEach(walk); }
  };
  walk(root);
  flush();
  return parts.join('\n');
}

/**
 * Extract clip text from the current selection, clamped to `container` (the
 * article body) so title/byline/ads outside it are never captured, and split
 * into blocks so headings don't merge into the paragraph below.
 */
export function extractClipText(container: Element): string {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
  const full = document.createRange();
  full.selectNodeContents(container);
  const parts: string[] = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    const r = sel.getRangeAt(i).cloneRange();
    // Clamp the range to the article body.
    if (r.compareBoundaryPoints(Range.START_TO_START, full) < 0) r.setStart(full.startContainer, full.startOffset);
    if (r.compareBoundaryPoints(Range.END_TO_END, full) > 0) r.setEnd(full.endContainer, full.endOffset);
    if (r.collapsed) continue;
    const t = fragmentToClipText(r.cloneContents());
    if (t) parts.push(t);
  }
  return parts.join('\n').replace(/\n{2,}/g, '\n').trim();
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

// Download any image (data URL or same-origin path) as a file.
export async function downloadImage(src: string, filename: string) {
  if (src.startsWith('data:')) { downloadDataUrl(src, filename); return; }
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    downloadDataUrl(src, filename);
  }
}
