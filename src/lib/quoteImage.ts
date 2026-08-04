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

  let quote = (o.quote || '').replace(/\s+/g, ' ').trim();
  if (quote.length > 340) quote = quote.slice(0, 337).replace(/\s+\S*$/, '') + '…';

  const maxW = W - pad * 2;
  const quoteTop = pad + 210, quoteBottom = H - 330;
  let size = 62, lines: string[] = [], lineH = 0;
  while (size >= 30) {
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, Arial, sans-serif`;
    lines = wrap(ctx, '“' + quote + '”', maxW);
    lineH = size * 1.32;
    if (lines.length * lineH <= quoteBottom - quoteTop) break;
    size -= 3;
  }
  ctx.fillStyle = '#f4f1ea'; ctx.font = `700 ${size}px ui-sans-serif, system-ui, Arial, sans-serif`;
  let y = quoteTop;
  for (const ln of lines) { ctx.fillText(ln, pad, y); y += lineH; }

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
