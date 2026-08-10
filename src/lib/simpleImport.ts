// "Simple upload" — turn a plain-text article pasted from Word / Google Docs /
// email into the same structured HTML the composer produces, so a non-technical
// colleague can post breaking news fast. Pure + unit-tested: no DOM, no React,
// so the detection rules are provable and reused by the modal UI.
//
// Pipeline: parsePastedArticle(raw) → { title, byline, blocks } → the modal lets
// the author flip any block heading/paragraph and move the auto-placed ads →
// blocksToHtml(blocks) → editor.commands.setContent(html).

export type BlockKind = 'p' | 'h' | 'ad';
export type ImportBlock = { kind: BlockKind; text?: string; size?: 'wide' | 'rectangle' };
export type ParsedArticle = { title: string; byline: string; blocks: ImportBlock[] };

// A byline line: "By Jane Smith", "By: Jane Smith", "By — Jane Smith". Kept
// deliberately strict (short, name-like) so a sentence that merely starts with
// "By the time…" is not mistaken for a byline.
const BY_RE = /^by[\s:.—-]+(.+)$/i;

function isBylineLine(line: string): string | null {
  if (line.length > 60) return null;
  const m = line.match(BY_RE);
  if (!m) return null;
  const name = m[1].trim().replace(/[.,;:]+$/, '');
  if (!name) return null;
  const words = name.split(/\s+/);
  if (words.length > 6) return null; // a real byline is a name, not a clause
  if (/[.!?]$/.test(m[1].trim())) return null; // ends like a sentence
  return name;
}

/**
 * Heuristic: does this standalone line read like a sub-heading rather than a
 * paragraph? Short, no sentence-ending punctuation, not a bullet, starts with a
 * capital/number. Best-effort only — the modal lets the author correct it.
 */
export function isLikelyHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 70) return false;
  if (/[.!?,:;]$/.test(t)) return false; // sentence-like ending
  if (/^[-*•·–—]/.test(t)) return false; // bullet / dash lead-in
  if (/^https?:\/\//i.test(t)) return false; // a bare URL
  if (t.split(/\s+/).length > 10) return false; // too long to be a heading
  if (/^[a-z]/.test(t)) return false; // headings don't start lowercase
  return true;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Parse pasted plain text into title + byline + body blocks. The first non-empty
 * line becomes the title; a byline line among the first couple of body lines is
 * lifted out; every remaining line becomes a paragraph or (by heuristic) a
 * sub-heading. Blank lines are separators and are dropped.
 */
export function parsePastedArticle(raw: string): ParsedArticle {
  const lines = (raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ') // Word non-breaking spaces
    .split('\n')
    .map((l) => l.replace(/\s+$/g, '').trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return { title: '', byline: '', blocks: [] };

  const title = lines.shift() as string;
  let byline = '';
  const body: ImportBlock[] = [];
  for (const line of lines) {
    if (!byline && body.length <= 1) {
      const name = isBylineLine(line);
      if (name) { byline = name; continue; }
    }
    body.push({ kind: isLikelyHeading(line) ? 'h' : 'p', text: line });
  }
  return { title: title.trim(), byline, blocks: body };
}

/**
 * Insert two "Auto" ad slots into a block list — roughly at the ⅓ and ⅔ marks
 * counting only content blocks, and never immediately before a heading (an ad
 * wedged right above a sub-head reads badly). Short pieces get one ad or none.
 */
export function withAutoAds(blocks: ImportBlock[]): ImportBlock[] {
  const content = blocks.filter((b) => b.kind !== 'ad');
  const n = content.length;
  if (n < 3) return blocks.filter((b) => b.kind !== 'ad'); // too short to warrant ads
  const targets = n < 6
    ? [Math.round(n / 2)]
    : [Math.max(1, Math.round(n / 3)), Math.max(2, Math.round((2 * n) / 3))];
  const sizes: Array<'wide' | 'rectangle'> = ['wide', 'rectangle'];

  const out: ImportBlock[] = [];
  let seen = 0;
  let ti = 0;
  const src = blocks.filter((b) => b.kind !== 'ad');
  for (let i = 0; i < src.length; i++) {
    out.push(src[i]);
    seen++;
    const next = src[i + 1];
    if (ti < targets.length && seen === targets[ti] && (!next || next.kind !== 'h')) {
      out.push({ kind: 'ad', size: sizes[ti] ?? 'wide' });
      ti++;
    }
  }
  return out;
}

/** Serialize blocks to the exact HTML the composer/reader expect. */
export function blocksToHtml(blocks: ImportBlock[]): string {
  const parts = blocks.map((b) => {
    if (b.kind === 'ad') {
      const size = b.size === 'rectangle' ? 'rectangle' : 'wide';
      return `<div data-ad-slot="" data-ad-brand="" data-ad-size="${size}" data-ad-label=""></div>`;
    }
    const text = escapeHtml(b.text || '');
    return b.kind === 'h' ? `<h2>${text}</h2>` : `<p>${text}</p>`;
  });
  return parts.join('');
}
