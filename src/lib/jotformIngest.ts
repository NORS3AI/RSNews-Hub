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

/** Fetch one creative with an SSRF guard, a timeout, and a size cap. Never throws. */
export async function fetchCreative(url: string): Promise<Buffer | null> {
  if (!isAllowedCreativeHost(url)) { log.warn('jotform: blocked creative host', { url }); return null; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'error', signal: ctrl.signal });
    if (!res.ok) return null;
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

  const vendorId = await findOrCreateVendor(parsed.vendorName);

  // A seasonal/holiday plan needs an explicit end; default to a 4-month window
  // from the start if the submission didn't include one.
  const plan = planByKey(parsed.planKey);
  const startAt = parsed.startAt ?? new Date();
  let endAt = parsed.endAt ?? undefined;
  if (plan?.seasonal && !endAt) endAt = addMonths(startAt, 4);

  const campaignId = await createCampaign({
    vendorName: parsed.vendorName, vendorId, plan: parsed.planKey,
    startAt, endAt: endAt ?? null, notes: parsed.notes || undefined, status: 'DRAFT',
  });

  // Fetch each creative and file it through the storage pipeline (validates +
  // optimizes + content-addresses). Store as inactive, unassigned Ads — they
  // don't serve until the admin assigns them to a flight and schedules it.
  let creatives = 0;
  for (const url of parsed.imageUrls) {
    const bytes = await fetchCreative(url);
    if (!bytes) continue;
    const stored = await putImage(bytes);
    if (!stored.ok) { log.warn('jotform: creative rejected by storage', { err: stored.error }); continue; }
    await prisma.ad.create({
      data: {
        brand: parsed.vendorName,
        headline: `${parsed.vendorName} — submitted ad`,
        imageWide: stored.url, imageRect: stored.url,
        active: false,
      },
    });
    creatives++;
  }

  return { vendorId, campaignId, creatives, parsed };
}
