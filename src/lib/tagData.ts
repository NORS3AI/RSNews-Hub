import { unstable_cache } from 'next/cache';
import { prisma } from './db';
import { publishedArticles } from './queries';

// Information layer for the tag listing page. Returns the tag record + its live
// article cards as one typed bundle, so the page never touches Prisma. `null` =
// no such tag (the page turns that into notFound()). Articles flow through the
// canonical card select (via publishedArticles → lib/cards).
//
// Cached in Next's data cache (60s TTL, shared across requests) — same rationale
// as getCategoryData: public, non-personalized, string-safe card dates.
export const getTagData = unstable_cache(
  async (slug: string) => {
    const tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) return null;
    const articles = await publishedArticles({ tags: { some: { tagId: tag.id } } });
    return { tag, articles };
  },
  ['tag-data'],
  { revalidate: 60, tags: ['reader-content'] },
);

export type TagPageData = NonNullable<Awaited<ReturnType<typeof getTagData>>>;

// Lightweight title lookup for generateMetadata — keeps Prisma out of the page.
export async function getTagMeta(slug: string) {
  return prisma.tag.findUnique({ where: { slug }, select: { name: true } });
}
