// Sponsored-CONTENT intake — pure parsing (no DB, no network), so the whole
// field mapping is unit-testable. A JotForm delivers a `rawRequest` JSON object
// keyed by field names; which field holds the company, headline, body copy, CTA,
// and uploaded creative differs per form, so the mapping is DATA (CONTENT_FIELD_MAP),
// overridable via env (JOTFORM_CONTENT_FIELD_MAP as JSON). The server side
// (lib/contentIngest) does the I/O: sanitize, store the creative, build a DRAFT.
//
// Sponsor body copy is treated as PLAIN TEXT — escaped and paragraph-wrapped
// here — never imported as HTML. Combined with the server-side sanitize on
// write, that means untrusted vendor text can carry no markup, links, or scripts
// of its own; the only link is the CTA, which we validate to http(s).

import { collectUrls } from './jotform';
import { safeLinkHref } from './utils';

export type ContentFieldMap = {
  vendorName: string;
  contactName: string;
  email: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  images: string;
};

// Readable defaults; a real form overrides these with its own field keys
// (e.g. "q5_headline") via the JOTFORM_CONTENT_FIELD_MAP env var.
export const DEFAULT_CONTENT_FIELD_MAP: ContentFieldMap = {
  vendorName: 'company',
  contactName: 'contactName',
  email: 'email',
  headline: 'headline',
  body: 'body',
  ctaLabel: 'ctaLabel',
  ctaHref: 'ctaHref',
  images: 'creative',
};

/** Parse the content field map from env (JSON), falling back to defaults per key. */
export function contentFieldMapFromEnv(raw: string | undefined): ContentFieldMap {
  if (!raw) return DEFAULT_CONTENT_FIELD_MAP;
  try {
    const o = JSON.parse(raw);
    return { ...DEFAULT_CONTENT_FIELD_MAP, ...(o && typeof o === 'object' ? o : {}) };
  } catch {
    return DEFAULT_CONTENT_FIELD_MAP;
  }
}

const str = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim();
    return Object.values(o).filter((x) => typeof x === 'string').join(' ').trim();
  }
  return '';
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Escape the five HTML-significant characters so plain text can't inject markup. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Turn a sponsor's plain-text body into safe paragraph HTML. Blank-line-separated
 * blocks become <p>; single newlines within a block become <br>. Every character
 * is HTML-escaped first, so nothing the vendor typed can render as markup.
 */
export function textToParagraphs(text: string): string {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((b) => `<p>${escapeHtml(b).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export type ParsedContent = {
  vendorName: string;
  contactName: string;  // the submitting person; '' if absent
  email: string;        // '' if absent/invalid
  headline: string;
  bodyHtml: string;     // sanitized-safe paragraph HTML (plain text only)
  ctaLabel: string;
  ctaHref: string;      // '' unless a valid http(s) link
  imageUrls: string[];
  issues: string[];     // non-fatal problems for the admin to see
};

// Bound the fields so a submission can't bloat a draft.
const MAX_HEADLINE = 200;
const MAX_BODY = 20_000;
const MAX_CTA_LABEL = 60;
// Cap the company name too — it's fuzzy-matched (Levenshtein) against every
// known vendor and can become a Vendor record, so an unbounded value is both a
// DoS vector and a junk row. A real company name is well under this.
const MAX_VENDOR_NAME = 120;

// "Smart grab": keywords we look for in a field's name when the explicit map key
// isn't present, so a form built with JotForm's own auto-names (e.g. "Company
// Name", "Full Name", a bare file upload) still maps correctly without config.
// Deliberately does NOT include generic money/plan words, so payment, package,
// price, quantity, phone, address, etc. are never grabbed.
const FIELD_KEYWORDS: Record<keyof ContentFieldMap, string[]> = {
  email: ['email', 'mail'],
  ctaHref: ['ctahref', 'buttonurl', 'buttonlink', 'ctalink', 'landingurl', 'landingpage', 'link', 'weburl', 'website', 'url'],
  ctaLabel: ['ctalabel', 'buttontext', 'buttonlabel', 'buttoncaption', 'calltoaction', 'cta'],
  images: ['creative', 'artwork', 'image', 'banner', 'graphic', 'logo', 'photo', 'upload', 'attachment', 'file'],
  headline: ['headline', 'articletitle', 'title', 'subject', 'heading'],
  vendorName: ['companyname', 'company', 'businessname', 'business', 'vendor', 'advertiser', 'brand', 'organization', 'organisation'],
  // The submitting PERSON. Resolved AFTER vendorName so "companyName" is claimed
  // as the company first; a bare "Name"/"Full Name"/"Contact" field is the person.
  contactName: ['contactname', 'fullname', 'yourname', 'contactperson', 'submittername', 'repname', 'contact', 'name'],
  body: ['articlebody', 'body', 'article', 'copy', 'content', 'story', 'writeup', 'submission', 'pressrelease', 'description'],
};

// Field priority: resolve the specific/unambiguous fields first so a generic
// one (body) can't swallow a key a specific field wanted. vendorName before
// contactName so the company field is claimed before the person field.
const RESOLVE_ORDER: (keyof ContentFieldMap)[] = ['email', 'ctaHref', 'ctaLabel', 'images', 'headline', 'vendorName', 'contactName', 'body'];

/** Normalize a JotForm field key for keyword matching: drop the qN_ prefix and
 *  any punctuation, lowercase. "q5_companyName" → "companyname". */
function normKey(k: string): string {
  return k.replace(/^q\d+_/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

const hasText = (v: unknown): boolean => str(v).length > 0;

/**
 * Resolve each canonical field to a value in the raw payload. An explicit map key
 * (from JOTFORM_CONTENT_FIELD_MAP) wins when it's present and non-empty; otherwise
 * we keyword-match an as-yet-unused field name. `images` additionally requires the
 * candidate to actually contain URL(s), so a stray text field can't pose as the
 * creative upload. Each raw key is consumed once, so two fields can't collide.
 */
export function smartResolve(raw: Record<string, unknown>, map: ContentFieldMap): Record<keyof ContentFieldMap, unknown> {
  const rawKeys = Object.keys(raw);
  const used = new Set<string>();
  const out = {} as Record<keyof ContentFieldMap, unknown>;
  const usable = (field: keyof ContentFieldMap, v: unknown) => field === 'images' ? collectUrls(v).length > 0 : hasText(v);

  // 1) Explicit map first (respects an admin-provided mapping exactly).
  for (const field of RESOLVE_ORDER) {
    const key = map[field];
    if (key && key in raw && usable(field, raw[key])) { out[field] = raw[key]; used.add(key); }
  }
  // 2) Keyword fallback for anything still unresolved.
  for (const field of RESOLVE_ORDER) {
    if (out[field] !== undefined) continue;
    const kws = FIELD_KEYWORDS[field];
    const hit = rawKeys.find((k) => !used.has(k) && usable(field, raw[k]) && kws.some((kw) => normKey(k).includes(kw)));
    if (hit) { out[field] = raw[hit]; used.add(hit); }
  }
  return out;
}

/** Parse a JotForm rawRequest object into the hub's canonical sponsored-draft shape. */
export function parseContentSubmission(raw: Record<string, unknown>, map: ContentFieldMap): ParsedContent {
  const issues: string[] = [];
  const f = smartResolve(raw, map);

  const vendorName = str(f.vendorName).slice(0, MAX_VENDOR_NAME);
  if (!vendorName) issues.push('No company name found — check the field map.');

  const contactName = str(f.contactName).slice(0, MAX_VENDOR_NAME);

  const headline = str(f.headline).slice(0, MAX_HEADLINE);
  if (!headline) issues.push('No headline found — a placeholder was used.');

  const bodyRaw = str(f.body).slice(0, MAX_BODY);
  const bodyHtml = textToParagraphs(bodyRaw);
  if (!bodyRaw) issues.push('No body copy found in the submission.');

  const imageUrls = collectUrls(f.images);
  if (!imageUrls.length) issues.push('No creative image found — the reserved ad was skipped.');

  const emailRaw = str(f.email).slice(0, 254); // RFC max address length; also caps input
  const email = EMAIL_RE.test(emailRaw) ? emailRaw : '';

  const ctaHref = safeLinkHref(str(f.ctaHref), '');
  const ctaLabelRaw = str(f.ctaLabel).slice(0, MAX_CTA_LABEL);
  const ctaLabel = ctaHref ? (ctaLabelRaw || 'Learn more') : '';

  return { vendorName, contactName, email, headline, bodyHtml, ctaLabel, ctaHref, imageUrls, issues };
}
