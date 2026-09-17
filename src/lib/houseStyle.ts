// The house-style checker — RS News Hub's "rule book" applied to draft prose. It
// NEVER rewrites silently: it returns positioned suggestions the writer can accept
// one at a time (or all at once). Two rule kinds:
//   • spelling — a term with one house spelling ("canonical") plus the off-house
//     "variants" to catch. Case is preserved (so a sentence-start "E-mail" → "Email")
//     unless the term is forced lowercase (e.g. e-commerce). Admins edit these as
//     plain text — canonical + a list of variants — never regex; the pattern is
//     generated here.
//   • oxford  — flags a serial ("A, B and C") missing its Oxford comma.
// Pure + framework-free so the client panel, the server, and the tests share one
// source. The rule list is admin-editable at runtime; these built-ins seed it and
// are the fallback when no list is supplied.

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

// A single spelling rule, in the shape admins edit (and the DB stores).
export type HouseStyleRule = {
  canonical: string;      // the correct house spelling
  variants: string[];     // off-house forms to catch (case-insensitive)
  forceLowercase?: boolean;
  message?: string | null;
};

// The starter rule book — seeded into the DB and used as the fallback everywhere.
export const BUILTIN_HOUSE_STYLE_RULES: HouseStyleRule[] = [
  { canonical: 'e-commerce', variants: ['ecommerce', 'e commerce'], forceLowercase: true, message: 'House style: always lowercase, hyphenated — “e-commerce”.' },
  { canonical: 'email', variants: ['e-mail', 'e mail'], message: 'House style: one word, no hyphen — “email”.' },
  { canonical: 'online', variants: ['on-line', 'on line'], message: 'House style: one word — “online”.' },
  { canonical: 'website', variants: ['web site', 'web-site'], message: 'House style: one word — “website”.' },
  { canonical: 'websites', variants: ['web sites', 'web-sites'], message: 'House style: one word — “websites”.' },
  { canonical: 'nonprofit', variants: ['non-profit', 'non profit'], message: 'House style: one word, no hyphen — “nonprofit”.' },
  { canonical: 'USPS', variants: ['usps'], message: 'Proper name — all caps: “USPS”.' },
  { canonical: 'FedEx', variants: ['fedex', 'fed ex', 'fed-ex'], message: 'Proper name — “FedEx”.' },
  { canonical: 'PayPal', variants: ['paypal', 'pay pal', 'pay-pal'], message: 'Proper name — “PayPal”.' },
];

/** Parse an admin-entered variant blob (commas and/or newlines) into a clean list. */
export function splitVariants(raw: string): string[] {
  return Array.from(new Set((raw ?? '').split(/[,\n]/).map((v) => v.trim()).filter(Boolean)));
}

/** The message shown for a rule (its own, or a sensible default). */
export function ruleMessage(rule: HouseStyleRule): string {
  return (rule.message && rule.message.trim()) || `House style: use “${rule.canonical}”.`;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build one case-insensitive pattern that matches the canonical (so wrong-case
// canonicals are caught too) plus every variant, longest-first so a longer form
// wins. Returns null for an empty rule.
function buildRulePattern(rule: HouseStyleRule): RegExp | null {
  const tokens = Array.from(new Set([rule.canonical, ...rule.variants].map((t) => t.trim()).filter(Boolean)))
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  if (!tokens.length) return null;
  return new RegExp(`\\b(?:${tokens.join('|')})\\b`, 'gi');
}

/** Match the canonical's capitalization to what was typed (unless forced lowercase). */
function casedReplacement(rule: HouseStyleRule, found: string): string {
  if (rule.forceLowercase) return rule.canonical;
  const c0 = found[0];
  if (c0 && c0 === c0.toUpperCase() && c0 !== c0.toLowerCase()) {
    return rule.canonical.charAt(0).toUpperCase() + rule.canonical.slice(1);
  }
  return rule.canonical;
}

function spellingSuggestions(text: string, rules: HouseStyleRule[]): StyleSuggestion[] {
  const out: StyleSuggestion[] = [];
  for (const rule of rules) {
    const pattern = buildRulePattern(rule);
    if (!pattern) continue;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      const found = m[0];
      const replacement = casedReplacement(rule, found);
      if (found !== replacement) {
        out.push({ start: m.index, end: m.index + found.length, found, replacement, kind: 'spelling', rule: rule.canonical, message: ruleMessage(rule) });
      }
      if (m.index === pattern.lastIndex) pattern.lastIndex++; // guard against zero-width
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
    const replacement = found.replace(/(\s+)(and|or)(\s)$/i, ',$1$2$3');
    if (found !== replacement) {
      out.push({ start: m.index, end: m.index + found.length, found, replacement, kind: 'oxford', rule: 'oxford-comma', message: 'Add the Oxford (serial) comma before “' + m[1] + '”.' });
    }
    if (m.index === OXFORD.lastIndex) OXFORD.lastIndex++;
  }
  return out;
}

/** All house-style suggestions for a body of text, sorted by position. Pass the
 *  admin-edited rule list; without it, the built-in rule book is used. */
export function checkHouseStyle(text: string, rules: HouseStyleRule[] = BUILTIN_HOUSE_STYLE_RULES): StyleSuggestion[] {
  if (!text) return [];
  return [...spellingSuggestions(text, rules), ...oxfordSuggestions(text)].sort((a, b) => a.start - b.start);
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
