import { prisma } from './db';
import { bylineIdsInContent, type BylineCard } from './byline';

// Resolve the CURRENT library values for every in-article Author card that links
// to a saved byline (data-bylineid) in the article HTML, keyed by id. Passed to
// ArticleContent so a title/photo/bio edit in the library propagates to every
// placed card. A deleted byline simply isn't in the map → the card falls back to
// its baked-in snapshot.
export async function resolveContentBylines(html: string | null | undefined): Promise<Record<string, BylineCard>> {
  const ids = bylineIdsInContent(html);
  if (!ids.length) return {};
  const rows = await prisma.byline.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, title: true, photo: true, bio: true },
  });
  const map: Record<string, BylineCard> = {};
  for (const r of rows) map[r.id] = { name: r.name, title: r.title ?? '', avatar: r.photo ?? '', bio: r.bio ?? '' };
  return map;
}
