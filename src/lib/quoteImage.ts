// Client-only: paints a branded quote card onto a canvas and returns a PNG
// data URL. Used by the news-clippings feature.

export type QuoteOpts = { quote: string; title?: string; author?: string | null; url?: string; slug?: string };

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

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2b333d'); g.addColorStop(1, '#141a21');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#E97D34'; ctx.fillRect(pad, pad, 96, 12);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(233,125,52,.92)'; ctx.font = '900 200px Georgia, serif';
  ctx.fillText('“', pad - 12, pad - 8);

  // Preserve block breaks (a heading vs the paragraph below it) captured in the
  // clip so the quote reads as intended instead of running blocks together.
  let blocks = clampBlocks((o.quote || '').split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean), 340);
  if (!blocks.length) blocks = [''];
  const disp = blocks.map((b, i) => (i === 0 ? '“' + b : b) + (i === blocks.length - 1 ? '”' : ''));

  const maxW = W - pad * 2;
  const quoteTop = pad + 210, avail = (H - 330) - quoteTop;
  let size = 62, wrapped: string[][] = [], lineH = 0, blockGap = 0;
  while (size >= 26) {
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, Arial, sans-serif`;
    lineH = size * 1.3; blockGap = Math.round(size * 0.6);
    wrapped = disp.map((b) => wrap(ctx, b, maxW));
    const total = wrapped.reduce((sum, ls, i) => sum + ls.length * lineH + (i ? blockGap : 0), 0);
    if (total <= avail) break;
    size -= 3;
  }
  ctx.fillStyle = '#f4f1ea'; ctx.font = `700 ${size}px ui-sans-serif, system-ui, Arial, sans-serif`;
  let y = quoteTop;
  wrapped.forEach((ls, i) => { if (i) y += blockGap; for (const ln of ls) { ctx.fillText(ln, pad, y); y += lineH; } });

  const by = H - 300;
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, by); ctx.lineTo(W - pad, by); ctx.stroke();

  ctx.fillStyle = '#E97D34'; roundRect(ctx, pad, by + 34, 68, 68, 15); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('RS', pad + 34, by + 34 + 36);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff'; ctx.font = '800 32px ui-sans-serif, Arial'; ctx.fillText('RSNews Hub', pad + 86, by + 40);
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 24px ui-sans-serif, Arial'; ctx.fillText(o.url || '', pad + 86, by + 78);

  const ty = by + 130;
  ctx.fillStyle = '#f4f1ea'; ctx.font = '800 34px ui-sans-serif, Arial';
  const titleLines = wrap(ctx, o.title || '', maxW).slice(0, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, pad, ty + i * 42));
  if (o.author) {
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 27px ui-sans-serif, Arial';
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
