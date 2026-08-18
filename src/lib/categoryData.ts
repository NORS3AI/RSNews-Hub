import { unstable_cache } from 'next/cache';
import { prisma } from './db';
import { publishedArticles } from './queries';

// Information layer for the category listing page. Returns everything the view
// needs — the category record + its live article cards — as one typed bundle, so
// the page component never touches Prisma. `null` = no such category, which the
// page turns into notFound(). Articles flow through the canonical card select
// (via publishedArticles → lib/cards), so they carry the derived `sponsored`
// flag for the Partner-content disclosure.
//
// Cached in Next's data cache: the query bundle is shared across all requests and
// recomputed at most once every 60s (the whole route is dynamic because the shell
// layout reads the auth cookie, so this is where the DB-load win actually lands
// under traffic). Safe to cache because nothing here is personalized — the same
// bytes for every visitor. Card date fields serialize to strings through the
// cache, which the card/badge views already tolerate (formatDate/isBreaking coerce
// strings), the same way cards already cross the RSC→client boundary. Bounded 60s
// staleness on newly-published/edited content is fine for a listing surface; bump
// freshness later with revalidateTag('reader-content') from the publish action.
export const getCategoryData = unstable_cache(
  async (slug: string) => {
    const category = await prisma.category.findUnique({ where: { slug } });
    if (!category) return null;
    const articles = await publishedArticles({ categoryId: category.id });
    return { category, articles };
  },
  ['category-data'],
  { revalidate: 60, tags: ['reader-content'] },
);

export type CategoryPageData = NonNullable<Awaited<ReturnType<typeof getCategoryData>>>;

// Lightweight title lookup for generateMetadata — keeps Prisma out of the page
// module entirely (the render path uses getCategoryData above).
export async function getCategoryMeta(slug: string) {
  return prisma.category.findUnique({ where: { slug }, select: { name: true } });
}

// The categories index — every category with its live published-article count.
// Cached like getCategoryData (public, non-personalized; 60s TTL).
export const getCategoriesData = unstable_cache(
  async () => prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } } },
  }),
  ['categories-index'],
  { revalidate: 60, tags: ['reader-content'] },
);

export type CategoriesData = Awaited<ReturnType<typeof getCategoriesData>>;
