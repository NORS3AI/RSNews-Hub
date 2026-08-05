// JotForm ingestion — pure parsing + safety helpers (no DB, no network), so the
// whole mapping is unit-testable. The webhook route (api/ingest/jotform) does
// the I/O: verify the secret, fetch creatives, create the draft campaign.
//
// A JotForm webhook delivers a `rawRequest` JSON object keyed by field names.
// Which field holds the vendor, the package, the dates, and the uploaded images
// differs per form, so the mapping is DATA (FIELD_MAP), overridable by env
// (JOTFORM_FIELD_MAP as JSON) — reconciling a real form is config, not code.

import { AD_PLANS } from './adPlans';

export type JotformFieldMap = {
  vendorName: string;
  plan: string;
  startDate: string;
  endDate: string;
  notes: string;
  images: string;
};

// Readable defaults; a real form overrides these with its own field keys
// (e.g. "q5_package") via the JOTFORM_FIELD_MAP env var.
export const DEFAULT_FIELD_MAP: JotformFieldMap = {
  vendorName: 'vendorName',
  plan: 'package',
  startDate: 'startDate',
  endDate: 'endDate',
  notes: 'notes',
  images: 'ads',
};

/** Parse the field map from env (JSON), falling back to the defaults per key. */
export function fieldMapFromEnv(raw: string | undefined): JotformFieldMap {
  if (!raw) return DEFAULT_FIELD_MAP;
  try {
    const o = JSON.parse(raw);
    return { ...DEFAULT_FIELD_MAP, ...(o && typeof o === 'object' ? o : {}) };
  } catch {
    return DEFAULT_FIELD_MAP;
  }
}

const str = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') {
    // JotForm sometimes nests answers, e.g. { first, last } or { text }.
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim();
    return Object.values(o).filter((x) => typeof x === 'string').join(' ').trim();
  }
  return '';
};

/** Map a submitted package label to an AD_PLANS key. Falls back to 'quarter'. */
export function resolvePlanKey(label: unknown): string {
  const s = str(label).toLowerCase();
  if (!s) return 'quarter';
  // Exact key or label match first.
  const exact = AD_PLANS.find((p) => p.key === s || p.label.toLowerCase() === s);
  if (exact) return exact.key;
  if (/premium|video/.test(s)) return 'premium';
  if (/holiday|seasonal/.test(s)) return 'holiday';
  if (/12|annual|year/.test(s)) return 'annual';
  if (/\b6\b|six|half/.test(s)) return 'half';
  if (/\b3\b|three|quarter/.test(s)) return 'quarter';
  return 'quarter';
}

/** Collect image URLs from a JotForm answer (array, or newline/space/comma list). */
export function collectUrls(v: unknown): string[] {
  const out: string[] = [];
  const push = (x: unknown) => { const s = str(x); if (/^https?:\/\//i.test(s)) out.push(s); };
  if (Array.isArray(v)) v.forEach(push);
  else if (typeof v === 'string') v.split(/[\s,]+/).forEach(push);
  else if (v && typeof v === 'object') Object.values(v).forEach(push);
  return [...new Set(out)];
}

/** A parsed date (YYYY-MM-DD or JotForm's {month,day,year}) or null. */
export function parseDate(v: unknown): Date | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const y = Number(o.year), m = Number(o.month), d = Number(o.day);
    if (y && m && d) { const dt = new Date(Date.UTC(y, m - 1, d)); return isNaN(dt.getTime()) ? null : dt; }
  }
  const s = str(v);
  if (!s) return null;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

export type ParsedSubmission = {
  vendorName: string;
  planKey: string;
  startAt: Date | null;
  endAt: Date | null;
  notes: string;
  imageUrls: string[];
  issues: string[];   // non-fatal problems for the admin to see
};

/** Parse a JotForm rawRequest object into the hub's canonical draft shape. */
export function parseJotformSubmission(raw: Record<string, unknown>, map: JotformFieldMap): ParsedSubmission {
  const issues: string[] = [];
  const vendorName = str(raw[map.vendorName]);
  if (!vendorName) issues.push('No vendor name found — check the field map.');
  const imageUrls = collectUrls(raw[map.images]);
  if (!imageUrls.length) issues.push('No creative images found in the submission.');
  const startAt = parseDate(raw[map.startDate]);
  return {
    vendorName,
    planKey: resolvePlanKey(raw[map.plan]),
    startAt,
    endAt: parseDate(raw[map.endDate]),
    notes: str(raw[map.notes]),
    imageUrls,
    issues,
  };
}

// ---- SSRF guard for fetching creatives -------------------------------------

// Only fetch creatives from JotForm's own upload hosts. This blocks a forged
// submission from pointing the fetcher at an internal address (SSRF).
const ALLOWED_HOST_RE = /(^|\.)jotform(pro)?\.(com|io)$/i;

/** Is this URL a safe creative source? https only, JotForm hosts only. */
export function isAllowedCreativeHost(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  // No userinfo, no explicit port tricks.
  if (u.username || u.password) return false;
  return ALLOWED_HOST_RE.test(u.hostname);
}
