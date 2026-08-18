// Integration test for server-side ad attribution in recordEvents. Advertiser
// reports must derive brand from the real Ad row, never from client-claimed props
// — so a forged beacon can't credit or poison any advertiser. Hits the DB.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { recordEvents } from './record';

const ctx = { visitorId: 'vis-test', userId: null, device: 'desktop' };
const ids: string[] = [];
async function mkAd(brand: string) {
  const a = await prisma.ad.create({ data: { brand, headline: `${brand} ad` } });
  ids.push(a.id);
  return a;
}
async function eventsFor(subjectId: string) {
  return prisma.analyticsEvent.findMany({ where: { subjectId }, select: { props: true, subjectType: true } });
}
afterEach(async () => {
  if (ids.length) {
    await prisma.analyticsEvent.deleteMany({ where: { subjectId: { in: ids } } });
    await prisma.ad.deleteMany({ where: { id: { in: ids } } });
    ids.length = 0;
  }
});

describe('recordEvents — ad attribution is server-authoritative', () => {
  it('overwrites a forged brand with the real Ad.brand', async () => {
    const ad = await mkAd('RealBrand');
    const stored = await recordEvents(
      [{ type: 'click', subjectType: 'ad', subjectId: ad.id, props: { brand: 'FakeBrand', campaignId: 'FakeBrand' } }],
      ctx,
    );
    expect(stored).toBe(1);
    const rows = await eventsFor(ad.id);
    expect(rows).toHaveLength(1);
    const props = JSON.parse(rows[0].props || '{}');
    expect(props.brand).toBe('RealBrand');
    expect(props.campaignId).toBe('RealBrand');
  });

  it('drops an ad event whose subjectId is not a real ad', async () => {
    const fakeId = 'no-such-ad-id-xyz';
    const stored = await recordEvents(
      [{ type: 'impression', subjectType: 'ad', subjectId: fakeId, props: { brand: 'GhostBrand' } }],
      ctx,
    );
    expect(stored).toBe(0);
    expect(await eventsFor(fakeId)).toHaveLength(0);
  });

  it('keeps non-ad events untouched even in a mixed batch', async () => {
    const ad = await mkAd('MixBrand');
    const stored = await recordEvents(
      [
        { type: 'impression', subjectType: 'ad', subjectId: ad.id, props: { brand: 'spoof' } },
        { type: 'pageview', subjectType: 'page', subjectId: ad.id, pageType: 'home' },
      ],
      ctx,
    );
    expect(stored).toBe(2);
    const rows = await eventsFor(ad.id);
    const adRow = rows.find((r) => r.subjectType === 'ad');
    const pageRow = rows.find((r) => r.subjectType === 'page');
    expect(JSON.parse(adRow!.props || '{}').brand).toBe('MixBrand');
    expect(pageRow).toBeTruthy(); // non-ad row stored as-is, not dropped
  });
});
