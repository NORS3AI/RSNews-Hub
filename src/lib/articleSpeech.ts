import { createHash } from 'crypto';

// Turns an article's stored HTML into clean, speakable text for TTS: keeps the
// prose (headings, paragraphs, lists, pull-quotes) and drops anything that
// shouldn't be read aloud — ad slots, author cards, poll/quiz embeds, buttons,
// images, dividers, spacers (the composer's element blocks are empty marker
// divs, so they contribute no words anyway; the one thing with visible text is
// a button label, which we strip). Pure + server-safe (no DOM).

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&rsquo;': '’',
  '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Clean article HTML into a single spoken-text string (title read first). */
export function articleToSpeech(html: string, title = ''): string {
  let s = html || '';
  // Drop things that shouldn't be spoken (with their text): button labels,
  // figures/captions, asides. The empty element markers (ad/author/poll/quiz/
  // spacer divs, images, hr) carry no text, so tag-stripping handles them.
  s = s.replace(/<a\b[^>]*(?:data-button|class="a-btn")[^>]*>[\s\S]*?<\/a>/gi, ' ');
  s = s.replace(/<(figure|figcaption|aside|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // End of a block → a line break, so sentences don't run together.
  s = s.replace(/<\/(p|h[1-6]|li|blockquote|div|tr|section)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' '); // strip remaining tags
  s = decodeEntities(s);

  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // Give each block terminal punctuation so the voice pauses between them.
  const body = lines.map((l) => (/[.!?:;]["'”’)]?$/.test(l) ? l : l + '.')).join(' ');
  const head = title.trim() ? title.trim().replace(/[.!?:;]?$/, (m) => m || '.') + ' ' : '';
  return (head + body).replace(/\s+/g, ' ').trim();
}

/** Stable fingerprint of the spoken text — regenerate audio only when it changes. */
export function speechHash(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/** Split spoken text into <= maxLen chunks at sentence boundaries (ElevenLabs
 *  caps request size; chunks are synthesized separately and the MP3s joined). */
export function chunkForTts(text: string, maxLen = 2500): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];
  const sentences = clean.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) || [clean];
  const chunks: string[] = [];
  let cur = '';
  for (const sentence of sentences) {
    // A single monster sentence longer than maxLen: hard-split on spaces.
    if (sentence.length > maxLen) {
      if (cur) { chunks.push(cur.trim()); cur = ''; }
      for (const piece of sentence.match(new RegExp(`[\\s\\S]{1,${maxLen}}`, 'g')) || []) chunks.push(piece.trim());
      continue;
    }
    if ((cur + sentence).length > maxLen) { chunks.push(cur.trim()); cur = sentence; }
    else cur += sentence;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}
