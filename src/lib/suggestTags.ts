// Tag suggester for the article composer + Newsroom push. The old version just
// counted word frequency, which surfaced filler like "store", "every", "post".
// This one draws from four ranked sources, best first, so the words it proposes
// are the ones a pack-and-ship editor would actually tag:
//
//   1. Known tags — phrases the newsroom has ALREADY used as tags (passed in from
//      the DB). Reusing the team's own vocabulary keeps tags consistent and, over
//      time, teaches the suggester every company name and product it has seen.
//   2. Domain glossary — the industry's standing vocabulary (e-commerce, returns,
//      fulfillment, mailboxes, printing, carriers, …), matched with spelling and
//      singular/plural variants.
//   3. Proper nouns — capitalized multi-word runs and acronyms (Pak Mail, FedEx,
//      USPS), which catch brands/products not yet in the glossary.
//   4. Salient words — a frequency fallback, now behind a much larger stop list
//      and a minimum-count gate, only to fill any remaining slots.
//
// Pure + dependency-free so the composer, the push action, and the tests all agree.

// Grammatical filler + generic newsroom words that must never become tags.
const STOP = new Set(
  ('a an and or but the of to in on for with at by from as is are was were be been being it its this that these those ' +
   'you your we our they their he she his her him them i me my mine ours us not no nor so if then than too very can could ' +
   'would should may might must will shall do does did done have has had having get gets got getting go goes going gone ' +
   'about into over under out up down off above below between through during before after while because since until per via vs ' +
   'more most some any all each every both few many much other another such own same how what when where who whom why which whose ' +
   'here there also just only even still yet ever never always often sometimes now today said says say tell told according ' +
   'store stores shop shops business businesses company companies customer customers owner owners service services thing things ' +
   'year years month months week weeks day days time times way ways make makes made need needs new news good great big small ' +
   'first last next back long high low right left top best better people work works working lot lots help helps helping use uses ' +
   'used using want wants like likes really actually maybe part parts number numbers place places kind sort area areas end ends')
    .split(' '),
);

// Words that give proper-noun runs a false positive when they open a sentence
// (they get capitalized just for being first). Not tags, and not brand starts.
const SENTENCE_START_NOISE = new Set(
  ('the a an this that these those it he she they we you i but and or so if when while after before because however ' +
   'meanwhile still now today there here his her their our your my one two three many some most each every last next')
    .split(' '),
);

// The pack-and-ship / print / mailbox trade's standing vocabulary. Each entry is
// [canonical, ...variants]; any variant found in the text yields the canonical tag.
// Multi-word terms match across a space OR hyphen ("pack and ship" / "pack-and-ship").
const GLOSSARY: string[][] = [
  ['e-commerce', 'ecommerce', 'e commerce'],
  ['returns', 'return processing', 'returns management'],
  ['fulfillment', 'fulfilment', 'order fulfillment', 'fulfillment center'],
  ['shipping', 'shipping services'],
  ['packaging', 'packing', 'custom packaging'],
  ['mailbox rental', 'mailbox rentals', 'mailbox'],
  ['mailboxes', 'private mailbox', 'private mailboxes', 'pmb'],
  ['po box', 'po boxes', 'post office box'],
  ['printing', 'print services', 'digital printing', 'wide-format printing', 'print shop'],
  ['copying', 'copies', 'photocopying'],
  ['notary', 'notary public', 'notarization', 'notarize'],
  ['passport photos', 'passport photo'],
  ['fingerprinting', 'live scan', 'livescan'],
  ['shredding', 'document shredding'],
  ['laminating', 'lamination'],
  ['binding', 'document binding'],
  ['signs', 'signage', 'banners'],
  ['business cards', 'business card'],
  ['freight', 'ltl freight', 'ltl'],
  ['crating', 'custom crating'],
  ['moving supplies', 'moving boxes'],
  ['last mile', 'last-mile delivery', 'last mile delivery'],
  ['dimensional weight', 'dim weight'],
  ['carriers', 'carrier'],
  ['USPS', 'usps', 'postal service', 'us postal service', 'united states postal service'],
  ['UPS'],
  ['FedEx', 'fedex', 'fed ex'],
  ['DHL'],
  ['Amazon'],
  ['peak season', 'holiday shipping', 'holiday season'],
  ['small business', 'small businesses'],
  ['franchise', 'franchising', 'franchisee', 'franchisees'],
  ['point of sale', 'pos system', 'point-of-sale'],
  ['gift wrapping', 'gift wrap'],
  ['greeting cards', 'greeting card'],
  ['package acceptance', 'package receiving', 'hold for pickup'],
  ['faxing', 'fax services'],
  ['scanning', 'document scanning'],
];

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word / whole-phrase matcher that treats space and hyphen as interchangeable
// separators, so "pack and ship" also finds "pack-and-ship".
function phraseRegex(term: string): RegExp {
  const core = escapeRe(term.trim()).replace(/(\\?[\s-])+/g, '[\\s-]+');
  return new RegExp(`(?<![\\w-])${core}(?![\\w-])`, 'gi');
}
function countMatches(text: string, term: string): number {
  const m = text.match(phraseRegex(term));
  return m ? m.length : 0;
}

type Cand = { tag: string; score: number; words: string[] };

/**
 * Suggest up to `opts.max` tags (default 8) for an article.
 * @param vocabulary existing tag names (from the DB) to prefer and reuse.
 */
export function suggestTags(
  title: string,
  html: string,
  opts: { vocabulary?: string[]; max?: number } = {},
): string[] {
  const max = opts.max ?? 8;
  const vocabulary = opts.vocabulary ?? [];
  const bodyText = stripHtml(html);
  const titleText = ` ${title} `;
  const full = `${title}\n${bodyText}`;
  const lowerTitle = title.toLowerCase();

  const cands: Cand[] = [];
  const claimed = new Set<string>(); // lowercased tags already proposed (dedup)
  const wordsCovered = new Set<string>(); // component words of chosen phrases

  const add = (tag: string, score: number) => {
    const key = tag.toLowerCase();
    // Dedup on an alphanumeric-only key too, so "e-commerce" and "ecommerce"
    // (different tokenizations of the same term) don't both get proposed.
    const norm = key.replace(/[^a-z0-9]/g, '');
    if (claimed.has(key) || (norm && claimed.has(norm))) return;
    claimed.add(key);
    if (norm) claimed.add(norm);
    const words = key.split(/[\s-]+/).filter(Boolean);
    cands.push({ tag, score, words });
  };
  const titleBonus = (term: string) => (phraseRegex(term).test(lowerTitle) ? 40 : 0);

  // 1. Known tags the newsroom already uses — highest priority (consistency).
  for (const name of vocabulary) {
    const n = name.trim();
    if (!n || n.length < 2) continue;
    const c = countMatches(full, n);
    if (c > 0) add(n, 1000 + c * 5 + titleBonus(n));
  }

  // 2. Domain glossary — the industry's standing vocabulary.
  for (const [canonical, ...variants] of GLOSSARY) {
    let c = 0;
    for (const term of [canonical, ...variants]) c += countMatches(full, term);
    if (c > 0) add(canonical, 500 + c * 4 + titleBonus(canonical));
  }

  // 3. Proper nouns — capitalized runs (Pak Mail) + internal-caps/acronyms (FedEx,
  // USPS). Sentence-opening common words are excluded so "The" / "This" don't leak.
  const properCounts = new Map<string, { display: string; count: number }>();
  for (const sentence of bodyText.split(/(?<=[.!?])\s+/)) {
    const toks = sentence.match(/[A-Za-z][A-Za-z0-9&.'-]*/g) || [];
    let run: string[] = [];
    const flush = () => {
      if (!run.length) return;
      // Drop a leading sentence-start noise word ("The Postal Service" → "Postal Service").
      if (run.length > 1 && SENTENCE_START_NOISE.has(run[0].toLowerCase())) run = run.slice(1);
      const phrase = run.join(' ');
      const key = phrase.toLowerCase();
      const isAcronymOrBrand = run.length === 1 && (/[A-Z].*[A-Z]/.test(run[0]) || /^[A-Z]{2,}$/.test(run[0]));
      // A single ordinary Capitalized word is too weak on its own unless it's a
      // brand-shaped token (FedEx, USPS); multi-word runs are always kept.
      if ((run.length >= 2 || isAcronymOrBrand) && !STOP.has(key) && phrase.length >= 2) {
        const prev = properCounts.get(key);
        if (prev) prev.count += 1;
        else properCounts.set(key, { display: phrase, count: 1 });
      }
      run = [];
    };
    toks.forEach((tok, i) => {
      const capitalized = /^[A-Z]/.test(tok);
      const startNoise = i === 0 && SENTENCE_START_NOISE.has(tok.toLowerCase());
      if (capitalized && !startNoise) run.push(tok);
      else flush();
    });
    flush();
  }
  for (const { display, count } of properCounts.values()) {
    const words = display.toLowerCase().split(/\s+/).length;
    add(display, 200 + count * 6 + (words >= 2 ? 20 : 0) + titleBonus(display));
  }

  // 4. Salient single words — frequency fallback, gated by the stop list and a
  // minimum count, only to fill slots the ranked sources didn't.
  const freq = new Map<string, number>();
  for (const w of (full.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [])) {
    if (STOP.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  for (const [w, c] of freq) {
    if (c < 2 && !lowerTitle.includes(w)) continue; // one-off body words aren't tags
    add(w, c + (lowerTitle.includes(w) ? 3 : 0));
  }

  // Rank, then drop any candidate whose words are fully covered by a higher-ranked
  // multi-word tag (so we don't emit "ship" beside "shipping services").
  cands.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  for (const c of cands) {
    if (out.length >= max) break;
    const subsumed = c.words.length === 1 && wordsCovered.has(c.words[0]);
    if (subsumed) continue;
    out.push(c.tag);
    if (c.words.length > 1) c.words.forEach((w) => wordsCovered.add(w));
  }
  return out;
}
