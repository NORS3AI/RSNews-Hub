// Integration tests for the ad-serving resolvers — these hit the DB (dev/CI
// SQLite from `prisma db push`), so they lock in behaviour a pure unit test
// can't reach: advertiser-locked slots resolving to a live creative or an RS
// house ad, competitor groups folding into suppression, the manual go-live
// window, and the advertiser list. Rows are namespaced by a unique brand and
// cleaned up, so this is safe against a shared DB.

import { describe, it, expect, afterEach } from 'vitest';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { loadAds, loadBrandArticleAds, listAdvertisers } from './adsServer';
import { brandKey } from './entitlements';

const day = 86_400_000;
let seq = 0;
const brand = (b: string) => `${b}-ait${Date.now().toString(36)}-${seq++}`;

const madeAds: string[] = [];
const madeGroups: string[] = [];
async function mkAd(data: Prisma.AdCreateInput) {
  const a = await prisma.ad.create({ data });
  madeAds.push(a.id);
  return a;
}
async function mkGroup(brands: string) {
  const g = await prisma.competitorGroup.create({ data: { name: `ITGROUP-${seq++}`, brands } });
  madeGroups.push(g.id);
  return g;
}
afterEach(async () => {
  if (madeAds.length) { await prisma.ad.deleteMany({ where: { id: { in: madeAds } } }); madeAds.length = 0; }
  if (madeGroups.length) { await prisma.competitorGroup.deleteMany({ where: { id: { in: madeGroups } } }); madeGroups.length = 0; }
});

describe('loadBrandArticleAds — advertiser lock + house fallback', () => {
  it('resolves a locked slot to that advertiser when they have a live creative', async () => {
    const acme = brand('Acme');
    await mkAd({ brand: acme, headline: 'Acme', imageWide: '/acme-wide.png', active: true });
    const key = brandKey(acme);
    const map = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${key}" data-ad-size="wide"></div>`);
    expect(map[`${key}::wide`]?.brand).toBe(acme);
  });

  it('falls back to an explicit RS house ad (never a competitor) when the advertiser has nothing live', async () => {
    // Only an EXPLICIT house ad (house:true) qualifies as the fallback.
    const houseAd = await mkAd({ brand: brand('RSHouse'), headline: 'House', imageWide: '/house.png', active: true, house: true });
    const ghost = brandKey(brand('GhostCo')); // an advertiser with zero ads
    const map = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${ghost}" data-ad-size="wide"></div>`);
    const fb = map[`${ghost}::wide`];
    expect(fb?.id).toBe(houseAd.id);
  });

  it('does NOT fall back to an always-on third-party ad (house must be explicit)', async () => {
    // Active, no flight, no window, house:false — an outside advertiser, NOT house.
    await mkAd({ brand: brand('RivalCo'), headline: 'Rival', imageWide: '/rival.png', active: true });
    const ghost = brandKey(brand('GhostCo2'));
    const map = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${ghost}" data-ad-size="wide"></div>`);
    expect(map[`${ghost}::wide`]).toBeUndefined(); // omitted → falls to Auto, never a rival
  });

  it('on a vendor-locked article, drops a competitor-locked slot so it falls to Auto', async () => {
    await mkAd({ brand: brand('RivalCo3'), headline: 'Rival', imageWide: '/r.png', active: true });
    const rivalKey = brandKey(brand('RivalCo3'));
    // lockBrand is some other vendor; the rival-locked slot must not resolve.
    const map = await loadBrandArticleAds(`<div data-ad-slot data-ad-brand="${rivalKey}" data-ad-size="wide"></div>`, 'packwise-locked-vendor');
    expect(map[`${rivalKey}::wide`]).toBeUndefined();
  });
});

describe('competitor groups', () => {
  it('fold group-mates into each member ad\'s competitor terms', async () => {
    const a = brand('Alpha'), b = brand('Beta');
    const adA = await mkAd({ brand: a, headline: 'Alpha', active: true });
    await mkGroup(`${a}, ${b}`);
    const loaded = (await loadAds()).find((x) => x.id === adA.id)!;
    expect(loaded.competitors.toLowerCase()).toContain(brandKey(b));
  });
});

describe('listAdvertisers — live window + shapes', () => {
  it('lists a live advertiser with the right shape flags', async () => {
    const name = brand('Vizible');
    await mkAd({ brand: name, headline: 'V', imageWide: '/w.png', imageRect: '/r.png', active: true });
    const found = (await listAdvertisers()).find((x) => x.brand === name);
    expect(found).toBeTruthy();
    expect(found!.wide).toBe(true);
    expect(found!.rect).toBe(true);
  });

  it('excludes an ad whose manual live-until window has passed', async () => {
    const name = brand('Expired');
    await mkAd({ brand: name, headline: 'E', imageWide: '/w.png', active: true, liveUntil: new Date(Date.now() - day) });
    expect((await listAdvertisers()).find((x) => x.brand === name)).toBeUndefined();
  });
});
