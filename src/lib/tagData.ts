import { prisma } from './db';
import { publishedArticles } from './queries';

// Information layer for the tag listing page. Returns the tag record + its live
// article cards as one typed bundle, so the page never touches Prisma. `null` =
// no such tag (the page turns that into notFound()). Articles flow through the
// canonical card select (via publishedArticles → lib/cards).
export async function getTagData(slug: string) {
  const tag = await prisma.tag.findUnique({ where: { slug } });
  if (!tag) return null;
  const articles = await publishedArticles({ tags: { some: { tagId: tag.id } } });
  return { tag, articles };
}

export type TagPageData = NonNullable<Awaited<ReturnType<typeof getTagData>>>;

// Lightweight title lookup for generateMetadata — keeps Prisma out of the page.
export async function getTagMeta(slug: string) {
  return prisma.tag.findUnique({ where: { slug }, select: { name: true } });
}
