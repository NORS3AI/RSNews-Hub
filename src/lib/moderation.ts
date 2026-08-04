// Reusable content moderation for user-submitted text.
//
// One pure entry point — `moderateText` — that every user-generated-text surface
// runs input through before storing/showing it (registration names, profile
// bios, and any future comments/community posts). No I/O, so it's fully
// unit-tested; configuration comes from env, read once per call.
//
// Verdicts:
//   ok:      the (cleaned) text is fine to store
//   flag:    store it but mark for admin review (borderline)
//   block:   reject it (return the reasons to the user)
//
// This is intentionally conservative and explainable rather than an ML model:
// predictable, dependency-free, and easy for a reviewer to reason about. Tune the
// blocklist via env (MODERATION_BLOCKLIST) without code changes.

export type Verdict = 'ok' | 'flag' | 'block';
export type ModerationResult = {
  verdict: Verdict;
  cleaned: string;      // normalized text (trimmed, collapsed whitespace, control chars stripped)
  reasons: string[];    // human-readable, safe to show the user on a block
};

export type ModerationOptions = {
  maxLength?: number;   // hard cap; longer → block (default 2000)
  maxLinks?: number;    // more than this → block as spam (default 2)
  allowLinks?: boolean; // when false, ANY link → block (default true)
};

// A deliberately small built-in list of unambiguous profanity, matched
// whole-word and leet-normalized. Extend per deployment with MODERATION_BLOCKLIST
// (comma-separated) rather than editing code. Kept minimal on purpose.
const BUILTIN_BLOCKLIST = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'dick', 'piss'];

function envList(name: string): string[] {
  return (process.env[name] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Normalize for storage/display: strip control chars, collapse whitespace, trim. */
export function cleanText(input: string): string {
  return input
    // Strip control chars except tab (\x09) and newline (\x0A), handled below.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/[ \t]+/g, ' ')            // collapse runs of spaces/tabs
    .replace(/[ \t]*\n[ \t]*/g, '\n')   // trim around newlines
    .replace(/\n{3,}/g, '\n\n')         // cap consecutive blank lines
    .trim();
}

// Fold common leet substitutions so "sh1t" / "f4ck" don't slip past the list.
function canonical(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')        // drop punctuation/separators
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
}

/** Whole-word profanity check against the built-in + env blocklist. */
export function containsProfanity(text: string): string[] {
  const words = new Set(canonical(text).split(/\s+/).filter(Boolean));
  const list = [...BUILTIN_BLOCKLIST, ...envList('MODERATION_BLOCKLIST')];
  return list.filter((bad) => words.has(canonical(bad)));
}

const URL_RE = /(?:https?:\/\/|www\.)?[a-z0-9-]+\.(?:com|net|org|io|ru|xyz|info|biz)\b/gi;
export function countLinks(text: string): number {
  return (text.match(URL_RE) || []).length;
}

/** Crude shout/repeat spam signals (used only to *flag*, never to block alone). */
export function looksLikeSpam(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  const shouty = letters.length >= 12 && letters === letters.toUpperCase();
  const repeated = /(.)\1{7,}/.test(text);   // same char x8+
  return shouty || repeated;
}

/**
 * Moderate a piece of user text. Returns the cleaned text plus a verdict and
 * reasons. Callers block on `block`, and may store-with-review on `flag`.
 */
export function moderateText(input: unknown, opts: ModerationOptions = {}): ModerationResult {
  const maxLength = opts.maxLength ?? 2000;
  const maxLinks = opts.maxLinks ?? 2;
  const allowLinks = opts.allowLinks ?? true;

  const cleaned = cleanText(typeof input === 'string' ? input : '');
  const reasons: string[] = [];

  if (!cleaned) return { verdict: 'block', cleaned, reasons: ['Text is empty.'] };
  if (cleaned.length > maxLength) reasons.push(`Too long (max ${maxLength} characters).`);

  if (containsProfanity(cleaned).length) reasons.push('Contains language that isn’t allowed.');

  const links = countLinks(cleaned);
  if (!allowLinks && links > 0) reasons.push('Links aren’t allowed here.');
  else if (links > maxLinks) reasons.push('Too many links (looks like spam).');

  if (reasons.length) return { verdict: 'block', cleaned, reasons };
  if (looksLikeSpam(cleaned)) return { verdict: 'flag', cleaned, reasons: ['Flagged for review (shouting/repetition).'] };
  return { verdict: 'ok', cleaned, reasons: [] };
}
