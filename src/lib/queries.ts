import { prisma } from './db';
import { cardSelect, toCard } from './cards';

// Shared visibility clause: PUBLISHED and not scheduled for the future.
export const liveWhere = () => ({ status: 'PUBLISHED', publishedAt: { lte: new Date() } });

// Category and tag listing pages. Uses the canonical card select + mapper
// (lib/cards) so these surfaces carry exactly the same fields as the homepage —
// including the derived `sponsored` flag that drives the "Partner content" FTC
// disclosure. (Previously a local select that omitted `sponsorVendorId`, so a
// vendor-connected article shown here carried no disclosure unless its genre
// happened to be literally 'sponsored'.)
export async function publishedArticles(where: any = {}, take = 24, skip = 0) {
  const rows = await prisma.article.findMany({
    where: { ...liveWhere(), ...where },
    orderBy: { publishedAt: 'desc' },
    select: cardSelect, take, skip,
  });
  return rows.map(toCard);
}
