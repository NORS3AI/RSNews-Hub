import { prisma } from './db';
import { DEFAULT_ADS, pickTwoInArticleAds, type AdRow } from './ads';

/** Load the active ad inventory (DB), falling back to the built-in defaults. */
export async function loadAds(): Promise<AdRow[]> {
  try {
    const rows = await prisma.ad.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.length ? rows : DEFAULT_ADS;
  } catch {
    return DEFAULT_ADS;
  }
}

/** Pick the two in-article ads (top + bottom) for an article's text. */
export async function pickArticleAds(context: string, prefix: string) {
  const ads = await loadAds();
  return pickTwoInArticleAds(ads, context, prefix);
}
