// The house-style checker — RS News Hub's "rule book" applied to draft prose. It
// NEVER rewrites silently: it returns positioned suggestions the writer can accept
// one at a time (or all at once). Two rule kinds:
//   • spelling — canonical forms of terms we always write the same way
//     (e.g. always lowercase "e-commerce", never "e-mail"). Case is preserved for
//     most rules (so a sentence-start "E-mail" → "Email"), except forced-lowercase
//     ones like e-commerce.
//   • oxford  — flags a serial ("A, B and C") that's missing its Oxford comma.
// Pure + framework-free so the client panel and the tests share one source.

export type StyleKind = 'spelling' | 'oxford';

export type StyleSuggestion = {
  start: number;        // index into the text (inclusive)
  end: number;          // index into the text (exclusive)
  found: string;        // the exact current substring
  replacement: string;  // what to change it to
  kind: StyleKind;
  rule: string;         // canonical form / short rule id (for the UI list)
  message: string;      // one-line human explanation
};

type SpellingRule = {
  canonical: string;
  // Matches every accepted-but-off variant (and the canonical itself; matches that
  // already equal the canonical are dropped). Must be global + case-insensitive.
  pattern: RegExp;
  // Force the canonical exactly (ignore the matched capitalization). Used for terms
  // we always lowercase, like e-commerce.
  forceLowercase?: boolean;
  message: string;
};

// The dictionary. High-precision on purpose — every entry is a term with one house
// spelling and a low false-positive risk. Add rows here to grow the rule book.
export const HOUSE_STYLE_RULES: SpellingRule[] = [
  { canonical: 'e-commerce', pattern: /\be-?commerce\b/gi, forceLowercase: true,
    message: 'House style: always lowercase, hyphenated — “e-commerce”.' },
  { canonical: 'email', pattern: /\be-mail\b/gi,
    message: 'House style: one word, no hyphen — “email”.' },
  { canonical: 'online', pattern: /\bon-line\b/gi,
    message: 'House style: one word — “online”.' },
  { canonical: 'website', pattern: /\bweb[\s-]site\b/gi,
    message: 'House style: one word — “website”.' },
  { canonical: 'websites', pattern: /\bweb[\s-]sites\b/gi,
    message: 'House style: one word — “websites”.' },
  { canonical: 'nonprofit', pattern: /\bnon-profit\b/gi,
    message: 'House style: one word, no hyphen — “nonprofit”.' },
  { canonical: 'USPS', pattern: /\busps\b/gi,
    message: 'Proper name — all caps: “USPS”.' },
  { canonical: 'FedEx', pattern: /\bfed[\s-]?ex\b/gi,
    message: 'Proper name — “FedEx”.' },
  { canonical: 'PayPal', pattern: /\bpaypal\b/gi,
    message: 'Proper name — “PayPal”.' },
];

/** Match the canonical's capitalization to what was typed (unless forced). */
function casedReplacement(rule: SpellingRule, found: string): string {
  if (rule.forceLowercase) return rule.canonical;
  // If the writer capitalized the first letter (sentence start, title), keep it.
  if (found[0] && found[0] === found[0].toUpperCase() && found[0] !== found[0].toLowerCase()) {
    return rule.canonical[0].toUpperCase() + rule.canonical.slice(1);
  }
  return rule.canonical;
}

function spellingSuggestions(text: string): StyleSuggestion[] {
  const out: StyleSuggestion[] = [];
  for (const rule of HOUSE_STYLE_RULES) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(text))) {
      const found = m[0];
      const replacement = casedReplacement(rule, found);
      if (found !== replacement) {
        out.push({ start: m.index, end: m.index + found.length, found, replacement, kind: 'spelling', rule: rule.canonical, message: rule.message });
      }
      if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++; // guard against zero-width
    }
  }
  return out;
}

// A serial list missing its Oxford comma: at least one earlier comma, then a
// comma-free item, then " and/or " with no comma before it. Non-greedy + stops at
// clause punctuation, so it only fires inside a single list. An already-correct
// "A, B, and C" never matches (the item before "and" is comma-terminated).
const OXFORD = /,\s+[^,.\n;:!?]+?\s+(and|or)\s/gi;

function oxfordSuggestions(text: string): StyleSuggestion[] {
  const out: StyleSuggestion[] = [];
  OXFORD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OXFORD.exec(text))) {
    const found = m[0];
    // Insert a comma before the conjunction: " and " → ", and " (keep spacing).
    const replacement = found.replace(/(\s+)(and|or)(\s)$/i, ',$1$2$3');
    if (found !== replacement) {
      out.push({ start: m.index, end: m.index + found.length, found, replacement, kind: 'oxford', rule: 'oxford-comma', message: 'Add the Oxford (serial) comma before “' + m[1] + '”.' });
    }
    if (m.index === OXFORD.lastIndex) OXFORD.lastIndex++;
  }
  return out;
}

/** All house-style suggestions for a body of text, sorted by position. */
export function checkHouseStyle(text: string): StyleSuggestion[] {
  if (!text) return [];
  return [...spellingSuggestions(text), ...oxfordSuggestions(text)].sort((a, b) => a.start - b.start);
}

/** Apply one suggestion, returning the new text. */
export function applySuggestion(text: string, s: StyleSuggestion): string {
  return text.slice(0, s.start) + s.replacement + text.slice(s.end);
}

/**
 * Apply many suggestions at once. Applied back-to-front so earlier indices stay
 * valid; overlapping suggestions are skipped (the first by position wins).
 */
export function applyAll(text: string, suggestions: StyleSuggestion[]): string {
  const ordered = [...suggestions].sort((a, b) => a.start - b.start);
  const kept: StyleSuggestion[] = [];
  let lastEnd = -1;
  for (const s of ordered) {
    if (s.start >= lastEnd) { kept.push(s); lastEnd = s.end; }
  }
  let out = text;
  for (const s of kept.sort((a, b) => b.start - a.start)) out = applySuggestion(out, s);
  return out;
}
