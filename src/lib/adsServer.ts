import { prisma } from './db';
import { DEFAULT_ADS, pickTwoInArticleAds, type AdRow } from './ads';

/** Load the ad inventory (DB) with each ad's flight window/status for live
 *  filtering, falling back to the built-in house defaults. */
export async function loadAds(): Promise<AdRow[]> {
  try {
    const rows = await prisma.ad.findMany({
      orderBy: { createdAt: 'asc' },
      include: { flight: { select: { status: true, startAt: true, endAt: true } } },
    });
    if (!rows.length) return DEFAULT_ADS;
    return rows.map((r) => ({
      ...r,
      flightStatus: r.flight?.status ?? null,
      flightStartAt: r.flight?.startAt ?? null,
      flightEndAt: r.flight?.endAt ?? null,
    }));
  } catch {
    return DEFAULT_ADS;
  }
}

/** Pick the two in-article ads (top + bottom) for an article's text. */
export async function pickArticleAds(context: string, prefix: string) {
  const ads = await loadAds();
  return pickTwoInArticleAds(ads, context, prefix);
}
