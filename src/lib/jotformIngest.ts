// JotForm ingestion — the server side (DB + network). Pure parsing lives in
// ./jotform; this fetches the creatives, files them through the storage
// pipeline, and creates a DRAFT campaign + creatives for the admin to review.
// Nothing goes live here — the admin schedules a flight to serve.

import { prisma } from './db';
import { log } from './logger';
import { putImage, maxUploadBytes } from './storage';
import { imageDimensions } from './storage/optimize';
import { classifyShape, pairCreatives, type AdShape } from './adSizes';
import { findOrCreateVendor } from './vendors';
import { createCampaign } from './campaigns';
import { planByKey, addMonths } from './adPlans';
import { recordPayment, parseAmountToCents, normalizePaymentStatus } from './payments';
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
export async function ingestSubmission(rawObj: Record<string, unknown>, submissionId?: string): Promise<IngestResult> {
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
  // Measure each creative's shape BEFORE storing (aspect ratio survives
  // optimization) so we can slot it automatically — no need for advertisers to
  // submit in any order.
  const storedCreatives: { url: string; shape: AdShape }[] = [];
  for (const url of urls) {
    const bytes = await fetchCreative(url);
    if (!bytes) continue;
    const dims = await imageDimensions(bytes);
    const stored = await putImage(bytes);
    if (!stored.ok) { log.warn('jotform: creative rejected by storage', { err: stored.error }); continue; }
    storedCreatives.push({ url: stored.url, shape: classifyShape(dims?.width, dims?.height) });
  }
  // Pair a banner + a rectangle into one ad; never stuff one image into both slots.
  const ads = pairCreatives(storedCreatives);

  // Create the vendor + DRAFT campaign + creatives atomically, so a mid-way
  // failure can't leave an orphaned campaign. Creatives are inactive/unassigned —
  // they don't serve until the admin assigns them to a flight and schedules it.
  const { vendorId, campaignId } = await prisma.$transaction(async (tx) => {
    const vendorId = await findOrCreateVendor(parsed.vendorName, tx);
    const campaignId = await createCampaign({
      vendorName: parsed.vendorName, vendorId, plan: parsed.planKey,
      startAt, endAt: endAt ?? null, notes: parsed.notes || undefined, status: 'DRAFT',
      // Archive who placed THIS order with the order itself.
      contactName: parsed.contactName || undefined, contactEmail: parsed.email || undefined,
    }, tx);
    for (const slot of ads) {
      await tx.ad.create({
        data: { brand: parsed.vendorName, headline: `${parsed.vendorName} — submitted ad`, imageWide: slot.imageWide, imageRect: slot.imageRect, imageTall: slot.imageTall, active: false },
      });
    }
    // If the form collected payment, record it (deduped on the transaction id) so
    // the campaign can go live. No payment info → stays unpaid until an admin
    // records/marks it. Never blocks the draft from being created.
    if (parsed.payment) {
      await recordPayment({
        campaignId, vendorId, submissionId,
        provider: 'jotform', externalId: parsed.payment.externalId || undefined,
        amountCents: parseAmountToCents(parsed.payment.amountRaw),
        status: normalizePaymentStatus(parsed.payment.statusRaw),
      }, tx);
    }
    return { vendorId, campaignId };
  });

  return { vendorId, campaignId, creatives: storedCreatives.length, parsed };
}
