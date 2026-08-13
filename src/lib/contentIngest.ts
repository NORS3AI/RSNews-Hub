// Sponsored-CONTENT ingestion — the server side (DB + network). Pure parsing
// lives in ./contentIntake and matching in ./vendorMatch; this fetches the
// creative, files it through the storage pipeline, matches the vendor
// typo-tolerantly, and BUILDS a DRAFT article + a reserved creative for review.
//
// Guarantees, by design:
//   • never auto-publishes — the article is always status DRAFT;
//   • never merges into an existing vendor on a guess — only a near-certain match
//     auto-links; a plausible one is HELD for admin confirmation;
//   • never renders vendor markup — body copy is escaped plain text, sanitized
//     again on write, and the only link is the validated CTA.

import { prisma } from './db';
import { log } from './logger';
import { putImage } from './storage';
import { brandKey } from './entitlements';
import { slugify, estimateReadMinutes, makeExcerpt } from './utils';
import { sanitizeArticleHtml } from './sanitize';
import { newPreviewToken } from './reviews';
import { fetchCreative } from './jotformIngest';
import { matchVendor, type MatchDecision } from './vendorMatch';
import { parseContentSubmission, contentFieldMapFromEnv, escapeHtml, type ParsedContent } from './contentIntake';

// A sponsored placement floats in the Featured homepage module for ~30 days
// (admin-editable per deal — see Phase 1). We default the window from ingest.
const SPONSOR_WINDOW_DAYS = 30;

export type ContentIngestResult = {
  submissionId?: string;
  articleId: string;
  slug: string;
  adId: string | null;
  vendorId: string | null;      // null while a suggested match awaits confirmation
  matchStatus: MatchDecision;   // auto | suggest | new
  matchVendorId: string | null;
  confidence: number;
  parsed: ParsedContent;
};

/** A slug free in the Article table, suffixing -2, -3, … on collision. */
async function uniqueArticleSlug(base: string): Promise<string> {
  const root = slugify(base) || 'sponsored';
  let slug = root;
  for (let n = 2; ; n++) {
    const hit = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
    if (!hit) return slug;
    slug = `${root}-${n}`;
  }
}

/**
 * Process one sponsored-content submission into a DRAFT article (+ reserved ad).
 * Returns the ids so the caller records them on the ContentSubmission. Throws on
 * a fatal issue (no company name) so the caller marks the submission FAILED.
 */
export async function ingestContentSubmission(rawObj: Record<string, unknown>, submissionId?: string): Promise<ContentIngestResult> {
  const parsed = parseContentSubmission(rawObj, contentFieldMapFromEnv(process.env.JOTFORM_CONTENT_FIELD_MAP));
  if (!parsed.vendorName) throw new Error('Submission has no company name (check JOTFORM_CONTENT_FIELD_MAP).');

  // 1) Fetch + store the creative FIRST (network — outside any DB transaction),
  //    behind the same SSRF guard + size cap as the ad pipeline. Only the first
  //    image becomes the reserved rectangle; extras are noted for the admin.
  let creativeUrl: string | null = null;
  if (parsed.imageUrls.length) {
    const bytes = await fetchCreative(parsed.imageUrls[0]);
    if (bytes) {
      const stored = await putImage(bytes);
      if (stored.ok) creativeUrl = stored.url;
      else { parsed.issues.push('Creative rejected by storage — reserved ad skipped.'); log.warn('content intake: creative rejected', { err: stored.error }); }
    } else {
      parsed.issues.push('Creative could not be fetched — reserved ad skipped.');
    }
    if (parsed.imageUrls.length > 1) parsed.issues.push(`Only the first of ${parsed.imageUrls.length} creatives was used.`);
  }

  // 2) Match the vendor typo-tolerantly against the known vendors.
  const vendors = await prisma.vendor.findMany({ select: { id: true, name: true } });
  const match = matchVendor(parsed.vendorName, vendors);
  const confidence = match.best?.score ?? 0;

  // 3) Resolve the vendor binding per the decision:
  //      auto    → link to the matched vendor;
  //      suggest → leave UNBOUND (confirm-before-merge) — admin decides;
  //      new     → create a fresh vendor, flagged autoCreated for review.
  let vendorId: string | null = null;
  let matchVendorId: string | null = match.best?.id ?? null;
  if (match.decision === 'auto') {
    vendorId = match.best!.id;
  } else if (match.decision === 'new') {
    const v = await prisma.vendor.upsert({
      where: { brandKey: brandKey(parsed.vendorName) },
      update: {},
      create: { name: parsed.vendorName.trim(), brandKey: brandKey(parsed.vendorName), autoCreated: true, orderContactEmail: parsed.email || null, orderContactName: parsed.contactName || null },
      select: { id: true },
    });
    vendorId = v.id;
    matchVendorId = v.id;
  }
  // Keep the vendor's latest ORDER contact person + email on file (each submission
  // can be a different rep). Writes only the order-contact fields — NEVER the
  // admin-curated, publicly-rendered phone-book contactName/contactEmail.
  if (vendorId && (parsed.contactName || parsed.email)) {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { ...(parsed.contactName ? { orderContactName: parsed.contactName } : {}), ...(parsed.email ? { orderContactEmail: parsed.email } : {}) },
    });
  }

  // 4) Create the reserved creative (out of rotation, hand-pickable — Phase 2),
  //    vendor-locked by brand so it can only ever serve for this advertiser.
  let adId: string | null = null;
  if (creativeUrl) {
    const ad = await prisma.ad.create({
      data: {
        brand: parsed.vendorName.trim(),
        headline: parsed.headline || `${parsed.vendorName} — sponsored`,
        cta: parsed.ctaLabel || 'Learn more',
        href: parsed.ctaHref || '#',
        keywords: brandKey(parsed.vendorName),
        imageRect: creativeUrl,
        active: true,
        reserved: true,
      },
      select: { id: true },
    });
    adId = ad.id;
  }

  // 5) Build the article body: escaped plain-text paragraphs, the reserved ad
  //    block (Phase 2 marker) after the copy, then the CTA button. Sanitize on
  //    write as defense-in-depth (the block markers are allowlisted).
  const adBlock = adId ? `<div data-ad-id="${adId}" data-ad-label="${escapeHtml(parsed.vendorName)}"></div>` : '';
  const ctaBlock = parsed.ctaHref
    ? `<p><a class="a-btn" data-button="1" href="${escapeHtml(parsed.ctaHref)}">${escapeHtml(parsed.ctaLabel || 'Learn more')}</a></p>`
    : '';
  const content = sanitizeArticleHtml(`${parsed.bodyHtml || '<p></p>'}${adBlock}${ctaBlock}`);

  const title = parsed.headline || `${parsed.vendorName} — sponsored`;
  const slug = await uniqueArticleSlug(title);
  const sponsoredUntil = new Date(Date.now() + SPONSOR_WINDOW_DAYS * 86_400_000);

  const article = await prisma.article.create({
    data: {
      title,
      slug,
      excerpt: makeExcerpt(content),
      content,
      status: 'DRAFT',            // NEVER auto-published
      genre: 'sponsored',         // doubles as the paid-placement disclosure
      sponsoredUntil,             // floats into Featured for the window (Phase 1)
      sponsorVendorId: vendorId,  // may be null until a suggested match is confirmed
      // The person who submitted THIS article — pinned here so the go-live email
      // addresses them even if the vendor's contact later changes.
      sponsorContactName: parsed.contactName || null,
      sponsorContactEmail: parsed.email || null,
      readMinutes: estimateReadMinutes(content),
      previewToken: newPreviewToken(), // ready to share for approval (Phase 1b)
    },
    select: { id: true },
  });

  // 6) Two-stage notify, stage one: ping the admins that a draft is waiting.
  await prisma.adminLog.create({
    data: {
      kind: 'content_submission',
      message: `Sponsored draft from “${parsed.vendorName}” is ready for review${match.decision === 'suggest' ? ` — confirm the vendor match (${confidence}%)` : ''}.`,
    },
  });

  return {
    submissionId, articleId: article.id, slug, adId,
    vendorId, matchStatus: match.decision, matchVendorId, confidence, parsed,
  };
}
