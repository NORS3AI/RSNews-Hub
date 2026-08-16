import { prisma } from './db';
import { publishedArticles } from './queries';

// Information layer for the category listing page. Returns everything the view
// needs — the category record + its live article cards — as one typed bundle, so
// the page component never touches Prisma. `null` = no such category, which the
// page turns into notFound(). Articles flow through the canonical card select
// (via publishedArticles → lib/cards), so they carry the derived `sponsored`
// flag for the Partner-content disclosure.
export async function getCategoryData(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return null;
  const articles = await publishedArticles({ categoryId: category.id });
  return { category, articles };
}

export type CategoryPageData = NonNullable<Awaited<ReturnType<typeof getCategoryData>>>;

// Lightweight title lookup for generateMetadata — keeps Prisma out of the page
// module entirely (the render path uses getCategoryData above).
export async function getCategoryMeta(slug: string) {
  return prisma.category.findUnique({ where: { slug }, select: { name: true } });
}

// The categories index — every category with its live published-article count.
export async function getCategoriesData() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } } },
  });
}

export type CategoriesData = Awaited<ReturnType<typeof getCategoriesData>>;
