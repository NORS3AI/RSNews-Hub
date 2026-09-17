// TEMPORARY red-team harness — adversarial checks on the ad-lock and the
// article/review lock. Hits the DB; rows are namespaced + cleaned up.
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from './db';
import { brandKey } from './entitlements';
import { pickInArticleAd, pickTwoInArticleAds, type AdRow } from './ads';
import { loadBrandArticleAds, resolveReservedArticleAds, resolveArticleLockBrand, UNRESOLVED_LOCK } from './adsServer';
import { recordVendorDecision, listVendorReviews } from './vendorReview';

const tag = `rt${Date.now().toString(36)}`;
const V = `PackWise ${tag}`;      // the connected vendor
const C = `RivalCo ${tag}`;       // the competitor — must NEVER appear under lock
const lock = brandKey(V);
const CTX = 'shipping packaging retail counter mailer supplies fulfillment';

const mk = (o: Partial<AdRow>): AdRow => ({
  id: o.id || `${tag}-${Math.random().toString(36).slice(2)}`,
  brand: o.brand || 'X', headline: o.headline || 'H', keywords: o.keywords ?? '', competitors: o.competitors ?? '',
  active: o.active ?? true, house: o.house ?? false, reserved: o.reserved ?? false,
  imageWide: o.imageWide ?? null, imageRect: o.imageRect ?? null, video: o.video ?? null, videoPoster: o.videoPoster ?? null,
  href: o.href || '#', cta: o.cta || 'Learn more', accent: o.accent || '#E97D34', label: o.label ?? null,
  liveFrom: o.liveFrom ?? null, liveUntil: o.liveUntil ?? null,
  flightId: o.flightId ?? null, flightStatus: o.flightStatus ?? null, flightStartAt: o.flightStartAt ?? null, flightEndAt: o.flightEndAt ?? null,
} as AdRow);

const madeAds: string[] = [];
const madeArticles: string[] = [];
const madeVendors: string[] = [];
const madeReq: string[] = [];
afterAll(async () => {
  await prisma.vendorReviewRequest.deleteMany({ where: { id: { in: madeReq } } });
  await prisma.articleReview.deleteMany({ where: { articleId: { in: madeArticles } } });
  await prisma.ad.deleteMany({ where: { id: { in: madeAds } } });
  await prisma.article.deleteMany({ where: { id: { in: madeArticles } } });
  await prisma.vendor.deleteMany({ where: { id: { in: madeVendors } } });
});

// ------------------------------ AD LOCK ------------------------------
describe('AD LOCK — no competitor can appear in a vendor-connected article', () => {
  const vAd = mk({ brand: V, keywords: lock, imageWide: '/v.png' });
  const cWide = mk({ brand: C, keywords: CTX, imageWide: '/c.png', imageRect: '/c2.png' });
  const cVideo = mk({ brand: C, keywords: CTX, video: '/c.mp4' });
  const house = mk({ brand: `RS House ${tag}`, house: true, imageWide: '/h.png' });
  const noLeak = (ad: AdRow | null) => expect(brandKey(ad?.brand ?? '')).not.toBe(brandKey(C));

  it('auto-pick under lock never returns the competitor (even when context matches it)', () => {
    for (let i = 0; i < 40; i++) noLeak(pickInArticleAd([vAd, cWide, house], CTX, `s${i}`, new Date(), '', CTX, lock));
  });
  it('a visiting RIVAL vendor (favorBrand=C) still cannot inject their ad under lock', () => {
    for (let i = 0; i < 40; i++) noLeak(pickInArticleAd([vAd, cWide, house], CTX, `s${i}`, new Date(), C, CTX, lock));
  });
  it('when the vendor has NO ad, lock falls to HOUSE — never the competitor', () => {
    for (let i = 0; i < 40; i++) { const r = pickInArticleAd([cWide, house], CTX, `s${i}`, new Date(), '', CTX, lock); noLeak(r); if (r) expect(r.house).toBe(true); }
  });
  it('when only the competitor exists (no vendor, no house), lock COLLAPSES to null', () => {
    for (let i = 0; i < 20; i++) expect(pickInArticleAd([cWide], CTX, `s${i}`, new Date(), '', CTX, lock)).toBeNull();
  });
  it('a competitor VIDEO cannot fill a locked slot', () => {
    for (let i = 0; i < 20; i++) noLeak(pickInArticleAd([cVideo, house], CTX, `s${i}`, new Date(), '', CTX, lock));
  });
  it('two-slot pick under lock: neither slot is the competitor', () => {
    for (let i = 0; i < 40; i++) { const { top, bottom } = pickTwoInArticleAds([vAd, cWide, house], CTX, `p${i}`, new Date(), '', CTX, lock); noLeak(top); noLeak(bottom); }
  });
  it('WITHOUT lock the competitor IS eligible (proves the lock is what blocks it)', () => {
    let sawC = false;
    for (let i = 0; i < 60; i++) { const r = pickInArticleAd([cWide, house], CTX, `s${i}`, new Date(), '', CTX, ''); if (brandKey(r?.brand ?? '') === brandKey(C)) sawC = true; }
    expect(sawC).toBe(true);
  });

  it('brand-locked SLOT + reserved lookups drop the competitor (DB); vendor resolves; casing/space tricks fail', async () => {
    // NOTE: no house:true ad created here — that would pollute the shared house-ad
    // pool other parallel DB tests assert on. House fallback is covered by the pure
    // in-memory pickInArticleAd tests above.
    const dbV = await prisma.ad.create({ data: { headline: 'H', brand: V, keywords: lock, imageWide: '/v.png', active: true } }); madeAds.push(dbV.id);
    const rV = await prisma.ad.create({ data: { headline: 'H', brand: V, imageRect: '/vr.png', active: true, reserved: true } }); madeAds.push(rV.id);
    const rC = await prisma.ad.create({ data: { headline: 'H', brand: C, imageRect: '/cr.png', active: true, reserved: true } }); madeAds.push(rC.id);
    const rDead = await prisma.ad.create({ data: { headline: 'H', brand: V, imageRect: '/vd.png', active: false, reserved: true } }); madeAds.push(rDead.id);
    // The reserved sponsor ad is EVERGREEN by default (rV: no liveUntil → stays).
    // Setting an optional limited-time `liveUntil` makes it DROP once passed, on its
    // own separate timer — independent of the article's sponsoredUntil/lifecycle.
    const rExpired = await prisma.ad.create({ data: { headline: 'H', brand: V, imageRect: '/vx.png', active: true, reserved: true, liveUntil: new Date(Date.now() - 86_400_000) } }); madeAds.push(rExpired.id);

    // A competitor brand-locked slot — even with uppercase + surrounding spaces — is dropped.
    const cKeyMangled = ` ${C.toUpperCase()} `;
    const slotMap = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${brandKey(C)}" data-ad-size="wide"></div><div data-ad-slot data-ad-brand="${cKeyMangled}" data-ad-size="wide"></div>`, lock);
    for (const k of Object.keys(slotMap)) expect(brandKey(slotMap[k].brand)).not.toBe(brandKey(C));

    // The vendor's own slot resolves to the vendor.
    const vSlot = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${lock}" data-ad-size="wide"></div>`, lock);
    expect(brandKey(vSlot[`${lock}::wide`]?.brand ?? '')).toBe(lock);

    // Reserved: competitor id dropped, vendor id resolves, deactivated vendor id dropped.
    const resMap = await resolveReservedArticleAds(`<div data-ad-id="${rV.id}"></div><div data-ad-id="${rC.id}"></div><div data-ad-id="${rDead.id}"></div><div data-ad-id="${rExpired.id}"></div>`, lock);
    expect(resMap[rV.id]?.brand).toBe(V);      // evergreen (no liveUntil) → stays
    expect(resMap[rC.id]).toBeUndefined();     // competitor reserved dropped
    expect(resMap[rDead.id]).toBeUndefined();  // deactivated dropped (liveness)
    expect(resMap[rExpired.id]).toBeUndefined(); // limited-time window passed → dropped
  });

  it('empty lockBrand does NOT accidentally happen for a connected article (brandKey of a real name is non-empty)', () => {
    expect(brandKey(V)).not.toBe('');
    expect(brandKey('  ')).toBe(''); // only a blank name yields empty — a real vendor never does
  });

  it('a CONNECTED article whose vendor was removed stays LOCKED (dangling id → house-only, never a competitor)', async () => {
    // resolveArticleLockBrand: not-connected → '' (no lock); connected+resolvable →
    // that vendor's brandKey; connected but vendor GONE → a non-empty sentinel.
    expect(await resolveArticleLockBrand(null)).toBe('');
    const danglingId = `no-such-vendor-${tag}`;
    const lockGone = await resolveArticleLockBrand(danglingId);
    expect(lockGone).toBe(UNRESOLVED_LOCK);
    expect(lockGone).not.toBe(''); // the critical part: NOT empty, so the hard-lock stays ON

    // Under that sentinel lock, the competitor is still blocked on every path.
    const cWide2 = mk({ brand: C, keywords: CTX, imageWide: '/c.png', imageRect: '/c2.png' });
    const house2 = mk({ brand: `RS House ${tag}`, house: true, imageWide: '/h.png' });
    for (let i = 0; i < 30; i++) {
      const r = pickInArticleAd([cWide2, house2], CTX, `s${i}`, new Date(), C, CTX, lockGone);
      expect(brandKey(r?.brand ?? '')).not.toBe(brandKey(C)); // house or null, never the rival
    }
    // A DB competitor brand-slot + reserved id are dropped under the sentinel too.
    const dbC2 = await prisma.ad.create({ data: { headline: 'H', brand: C, keywords: CTX, imageWide: '/c.png', active: true } }); madeAds.push(dbC2.id);
    const rC2 = await prisma.ad.create({ data: { headline: 'H', brand: C, imageRect: '/cr.png', active: true, reserved: true } }); madeAds.push(rC2.id);
    const sm = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${brandKey(C)}" data-ad-size="wide"></div>`, lockGone);
    for (const k of Object.keys(sm)) expect(brandKey(sm[k].brand)).not.toBe(brandKey(C));
    const rm = await resolveReservedArticleAds(`<div data-ad-id="${rC2.id}"></div>`, lockGone);
    expect(rm[rC2.id]).toBeUndefined();
  });
});

// --------------------------- ARTICLE / REVIEW LOCK ---------------------------
describe('REVIEW LOCK — one decision, no flip/reopen, cross-vendor isolation, token withheld', () => {
  it('locks on first decision; a second decision cannot flip or reopen it', async () => {
    const v = await prisma.vendor.create({ data: { name: `${V} rl1`, brandKey: brandKey(`${V} rl1`) } }); madeVendors.push(v.id);
    const a = await prisma.article.create({ data: { title: 'RL', slug: `rl-${tag}-1`, content: '<p>x</p>', status: 'DRAFT', previewToken: `tok-${tag}-1` } }); madeArticles.push(a.id);
    const r = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id } }); madeReq.push(r.id);
    expect(await recordVendorDecision({ requestId: r.id, articleId: a.id, decision: 'approve', message: '', firstName: 'A', lastName: 'B' })).toBe(true);
    expect(await recordVendorDecision({ requestId: r.id, articleId: a.id, decision: 'change', message: 'flip!', firstName: 'A', lastName: 'B' })).toBe(false);
    const after = await prisma.vendorReviewRequest.findUnique({ where: { id: r.id } });
    expect(after?.decision).toBe('approve'); // not flipped to 'change'
    expect(await prisma.articleReview.count({ where: { articleId: a.id } })).toBe(1); // mirrored once
  });

  it('concurrent double-submit: exactly one wins', async () => {
    const v = await prisma.vendor.create({ data: { name: `${V} rl2`, brandKey: brandKey(`${V} rl2`) } }); madeVendors.push(v.id);
    const a = await prisma.article.create({ data: { title: 'RL2', slug: `rl-${tag}-2`, content: '<p>x</p>', status: 'DRAFT' } }); madeArticles.push(a.id);
    const r = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id } }); madeReq.push(r.id);
    const res = await Promise.all([
      recordVendorDecision({ requestId: r.id, articleId: a.id, decision: 'approve', message: '', firstName: 'A', lastName: 'B' }),
      recordVendorDecision({ requestId: r.id, articleId: a.id, decision: 'change', message: 'x', firstName: 'A', lastName: 'B' }),
    ]);
    expect(res.filter(Boolean).length).toBe(1);
  });

  it('cross-vendor: listVendorReviews only ever returns the caller vendor’s rows', async () => {
    const v1 = await prisma.vendor.create({ data: { name: `${V} v1`, brandKey: brandKey(`${V} v1`) } }); madeVendors.push(v1.id);
    const v2 = await prisma.vendor.create({ data: { name: `${V} v2`, brandKey: brandKey(`${V} v2`) } }); madeVendors.push(v2.id);
    const a = await prisma.article.create({ data: { title: 'RL3', slug: `rl-${tag}-3`, content: '<p>x</p>', status: 'DRAFT', previewToken: `tok-${tag}-3` } }); madeArticles.push(a.id);
    const r1 = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v1.id } }); madeReq.push(r1.id);
    const r2 = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v2.id } }); madeReq.push(r2.id);
    const l1 = await listVendorReviews(v1.id);
    expect(l1.some((x) => x.id === r1.id)).toBe(true);
    expect(l1.some((x) => x.id === r2.id)).toBe(false);
  });

  it('previewToken is shipped only while pending+unpublished, and withheld once decided OR published', async () => {
    const v = await prisma.vendor.create({ data: { name: `${V} v4`, brandKey: brandKey(`${V} v4`) } }); madeVendors.push(v.id);
    const a = await prisma.article.create({ data: { title: 'RL4', slug: `rl-${tag}-4`, content: '<p>x</p>', status: 'DRAFT', previewToken: `tok-${tag}-4` } }); madeArticles.push(a.id);
    const r = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id } }); madeReq.push(r.id);
    let card = (await listVendorReviews(v.id)).find((x) => x.id === r.id)!;
    expect(card.article.previewToken).toBe(`tok-${tag}-4`); // pending + draft → token present
    await recordVendorDecision({ requestId: r.id, articleId: a.id, decision: 'approve', message: '', firstName: 'A', lastName: 'B' });
    card = (await listVendorReviews(v.id)).find((x) => x.id === r.id)!;
    expect(card.article.previewToken).toBeNull(); // decided → withheld
    // Publishing also withholds (fresh pending req on a published article).
    await prisma.article.update({ where: { id: a.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const r2 = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id } }); madeReq.push(r2.id);
    card = (await listVendorReviews(v.id)).find((x) => x.id === r2.id)!;
    expect(card.article.previewToken).toBeNull(); // published → withheld
  });

  it('re-push is independent: the old decided round stays locked, the new one is actionable', async () => {
    const v = await prisma.vendor.create({ data: { name: `${V} v5`, brandKey: brandKey(`${V} v5`) } }); madeVendors.push(v.id);
    const a = await prisma.article.create({ data: { title: 'RL5', slug: `rl-${tag}-5`, content: '<p>x</p>', status: 'DRAFT' } }); madeArticles.push(a.id);
    const r1 = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id } }); madeReq.push(r1.id);
    await recordVendorDecision({ requestId: r1.id, articleId: a.id, decision: 'change', message: 'fix', firstName: 'A', lastName: 'B' });
    const r2 = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id } }); madeReq.push(r2.id); // re-push
    const old = await prisma.vendorReviewRequest.findUnique({ where: { id: r1.id } });
    const neu = await prisma.vendorReviewRequest.findUnique({ where: { id: r2.id } });
    expect(old?.decidedAt).not.toBeNull();  // still locked
    expect(old?.decision).toBe('change');
    expect(neu?.decidedAt).toBeNull();      // new round pending
    // The new round accepts a fresh decision; the old one still rejects.
    expect(await recordVendorDecision({ requestId: r2.id, articleId: a.id, decision: 'approve', message: '', firstName: 'A', lastName: 'B' })).toBe(true);
    expect(await recordVendorDecision({ requestId: r1.id, articleId: a.id, decision: 'approve', message: '', firstName: 'A', lastName: 'B' })).toBe(false);
  });
});
