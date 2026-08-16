import { prisma } from './db';
import { getCurrentUser } from './auth';
import { entitlementsOf, isVendor, brandKey } from './entitlements';
import { activeViewAs } from './viewAsServer';
import { applyViewAs } from './viewAs';
import { vendorIdForBrand } from './vendors';
import { listPublishedReports } from './reports';
import { testimonialsForVendorDashboard } from './testimonials';
import { AD_UPDATE_URL_KEY } from './vendorReports';
import { loadAds, listAdvertisers } from './adsServer';
import { listVendorReviews } from './vendorReview';
import { formatDate } from './utils';

const TABS = [['current', 'Current ads'], ['performance', 'Ad performance'], ['history', 'Ad history']] as const;

// Information layer for the vendor ad dashboard. Owns the fetch + the access
// decision, returning a discriminated result the page renders:
//   { kind: 'signedout' }  → "sign in" notice
//   { kind: 'notvendor' }  → "this area is for advertisers" notice
//   { kind: 'full', ... }  → the dashboard bundle
// Admin "View as vendor" surfaces that vendor's real dashboard, so the gate is
// evaluated against the impersonated entitlements just like the page did inline.
export async function getVendorDashboardData(tabParam: string | undefined) {
  const user = await getCurrentUser();
  const viewingAs = await activeViewAs(user);
  const ent = entitlementsOf(viewingAs ? applyViewAs(user, viewingAs) : (user ?? {}));

  if (!user) return { kind: 'signedout' as const };
  if (!isVendor(ent)) return { kind: 'notvendor' as const };

  const brand = brandKey(ent.vendorBrand);
  const vendorId = await vendorIdForBrand(ent.vendorBrand);
  const mine = vendorId
    ? await prisma.adCampaign.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, include: { flights: { orderBy: { index: 'asc' } } } })
    // Fallback for a brand with no Vendor row yet: match by name. Guarded on a
    // non-empty brand key so an empty brand can never trigger a full-table scan.
    : brand
      ? (await prisma.adCampaign.findMany({ orderBy: { createdAt: 'desc' }, include: { flights: { orderBy: { index: 'asc' } } } })).filter((c) => brandKey(c.vendorName) === brand)
      : [];

  const now = new Date();
  const current = mine.filter((c) => c.status === 'ACTIVE');
  const past = mine.filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED');
  const [reports, testimonials, updateUrlRow, latestReq, articleReviews] = await Promise.all([
    vendorId ? listPublishedReports(vendorId) : Promise.resolve([]),
    vendorId ? testimonialsForVendorDashboard(vendorId) : Promise.resolve([]),
    prisma.setting.findUnique({ where: { key: AD_UPDATE_URL_KEY } }),
    vendorId ? prisma.adReportRequest.findFirst({ where: { vendorId }, orderBy: { createdAt: 'desc' } }) : Promise.resolve(null),
    vendorId ? listVendorReviews(vendorId) : Promise.resolve([]),
  ]);
  const updateUrl = updateUrlRow?.value || '';

  // Article-review tab: shown only when the vendor has articles shared with them.
  // Land on it by default when something is pending, so an approval isn't missed.
  const pendingReviews = articleReviews.filter((r) => !r.decidedAt && r.article.status !== 'PUBLISHED').length;
  const showReviewsTab = articleReviews.length > 0;
  const TAB_LIST: readonly (readonly [string, string])[] = showReviewsTab ? [['reviews', 'Article reviews'], ...TABS] : TABS;
  const tab = TAB_LIST.some((t) => t[0] === tabParam) ? tabParam! : (pendingReviews > 0 ? 'reviews' : 'current');

  // The vendor's creatives on file, for "view your current ads". One tile PER
  // SHAPE the vendor has (an ad can carry both a wide banner and a rectangle).
  const vendorAds = (await loadAds()).filter((a) => brandKey(a.brand) === brandKey(ent.vendorBrand) && (a.imageWide || a.imageRect));
  const creatives = vendorAds.flatMap((a) => [
    ...(a.imageWide ? [{ id: `${a.id}-wide`, brand: a.brand, img: a.imageWide, shape: 'Wide banner' }] : []),
    ...(a.imageRect ? [{ id: `${a.id}-rect`, brand: a.brand, img: a.imageRect, shape: 'Rectangle' }] : []),
  ]);
  // Which ad-slot shapes they currently have a LIVE creative for — powers the
  // preview + the "coverage" checklist (what you have vs. what you're missing).
  const shapes = (await listAdvertisers()).find((a) => a.key === brandKey(ent.vendorBrand));
  const coverage: { label: string; where: string; has: boolean }[] = [
    { label: 'Wide banner', where: 'Homepage banners & article leaderboards', has: !!shapes?.wide },
    { label: 'Rectangle', where: 'Homepage rectangle row & in-article boxes', has: !!shapes?.rect },
    { label: 'Video', where: 'In-article video ad slots', has: !!shapes?.video },
  ];
  const liveFlights = current.flatMap((c) => c.flights).filter((f) => f.status === 'SCHEDULED' && now >= f.startAt && now < f.endAt);
  const liveSince = liveFlights.length ? liveFlights.map((f) => f.startAt).sort((a, b) => a.getTime() - b.getTime())[0] : null;

  // Report-request state (rate limit surfaced to the vendor).
  const reqPending = latestReq?.status === 'PENDING';
  const cooldownUntil = latestReq ? new Date(latestReq.createdAt.getTime() + 30 * 864e5) : null;
  const inCooldown = !reqPending && cooldownUntil ? now < cooldownUntil : false;
  const reqDisabled = reqPending || inCooldown;
  const reqNote = reqPending
    ? 'You have a report request in progress — we’ll send it over soon.'
    : inCooldown && cooldownUntil ? `You can request another report after ${formatDate(cooldownUntil)}.` : undefined;

  return {
    kind: 'full' as const,
    user, ent, mine, now, current, past,
    reports, testimonials, updateUrl, latestReq, articleReviews,
    pendingReviews, showReviewsTab, TAB_LIST, tab,
    creatives, coverage, liveSince,
    reqDisabled, reqNote,
  };
}

export type VendorDashboardFull = Extract<Awaited<ReturnType<typeof getVendorDashboardData>>, { kind: 'full' }>;
