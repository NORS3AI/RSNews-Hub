// JotForm ingestion — the server side (DB + network). Pure parsing lives in
// ./jotform; this fetches the creatives, files them through the storage
// pipeline, and creates a DRAFT campaign + creatives for the admin to review.
// Nothing goes live here — the admin schedules a flight to serve.

import { prisma } from './db';
import { log } from './logger';
import { putImage, maxUploadBytes } from './storage';
import { findOrCreateVendor } from './vendors';
import { createCampaign } from './campaigns';
import { planByKey, addMonths } from './adPlans';
import { parseJotformSubmission, fieldMapFromEnv, isAllowedCreativeHost, type ParsedSubmission } from './jotform';

const FETCH_TIMEOUT_MS = 10_000;
// Cap creatives per submission so one webhook can't fan out into thousands of
// outbound fetches / sharp decodes / rows (DoS + amplification).
export const MAX_CREATIVES = 12;

/** Fetch one creative with an SSRF guard, a timeout, and a size cap. Never throws. */
export async function fetchCreative(url: string): Promise<Buffer | null> {
  if (!isAllowedCreativeHost(url)) { log.warn('jotform: blocked creative host', { url }); return null; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'error', signal: ctrl.signal });
    if (!res.ok) return null;
    // Reject oversize before buffering when the server declares a length.
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxUploadBytes()) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > maxUploadBytes()) return null;
    return buf;
  } catch (e) {
    log.warn('jotform: creative fetch failed', { url, err: (e as Error).message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type IngestResult = { vendorId: string; campaignId: string; creatives: number; parsed: ParsedSubmission };

/**
 * Process one parsed submission into a DRAFT campaign with creatives. Returns the
 * ids so the caller can record them on the AdSubmission. Throws on a fatal issue
 * (no vendor), so the caller marks the submission FAILED.
 */
export async function ingestSubmission(rawObj: Record<string, unknown>): Promise<IngestResult> {
  const parsed = parseJotformSubmission(rawObj, fieldMapFromEnv(process.env.JOTFORM_FIELD_MAP));
  if (!parsed.vendorName) throw new Error('Submission has no vendor name (check JOTFORM_FIELD_MAP).');

  // A seasonal/holiday plan needs an explicit end; default to a 4-month window
  // from the start if the submission didn't include one.
  const plan = planByKey(parsed.planKey);
  const startAt = parsed.startAt ?? new Date();
  let endAt = parsed.endAt ?? undefined;
  if (plan?.seasonal && !endAt) endAt = addMonths(startAt, 4);

  // Fetch + store creatives FIRST (network — must be outside the DB transaction),
  // capped so one submission can't fan out into unbounded work. Each is filed
  // through the storage pipeline (validates + optimizes + content-addresses).
  const urls = parsed.imageUrls.slice(0, MAX_CREATIVES);
  if (parsed.imageUrls.length > MAX_CREATIVES) {
    parsed.issues.push(`Only the first ${MAX_CREATIVES} of ${parsed.imageUrls.length} creatives were imported.`);
  }
  const storedUrls: string[] = [];
  for (const url of urls) {
    const bytes = await fetchCreative(url);
    if (!bytes) continue;
    const stored = await putImage(bytes);
    if (!stored.ok) { log.warn('jotform: creative rejected by storage', { err: stored.error }); continue; }
    storedUrls.push(stored.url);
  }

  // Create the vendor + DRAFT campaign + creatives atomically, so a mid-way
  // failure can't leave an orphaned campaign. Creatives are inactive/unassigned —
  // they don't serve until the admin assigns them to a flight and schedules it.
  const { vendorId, campaignId } = await prisma.$transaction(async (tx) => {
    const vendorId = await findOrCreateVendor(parsed.vendorName, tx);
    const campaignId = await createCampaign({
      vendorName: parsed.vendorName, vendorId, plan: parsed.planKey,
      startAt, endAt: endAt ?? null, notes: parsed.notes || undefined, status: 'DRAFT',
    }, tx);
    for (const url of storedUrls) {
      await tx.ad.create({
        data: { brand: parsed.vendorName, headline: `${parsed.vendorName} — submitted ad`, imageWide: url, imageRect: url, active: false },
      });
    }
    return { vendorId, campaignId };
  });

  return { vendorId, campaignId, creatives: storedUrls.length, parsed };
}
