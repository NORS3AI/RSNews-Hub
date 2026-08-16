import { prisma } from './db';

// Information layer for the CMS "static page" route (privacy, terms, about, …).
// Returns the page only when it's PUBLISHED; null otherwise, which the page turns
// into notFound().
export async function getStaticPageData(slug: string) {
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page || page.status !== 'PUBLISHED') return null;
  return page;
}

export type StaticPageData = NonNullable<Awaited<ReturnType<typeof getStaticPageData>>>;

// Title lookup for generateMetadata — deliberately unfiltered by status (matches
// the original: a draft page still resolves its title for metadata).
export async function getStaticPageMeta(slug: string) {
  return prisma.page.findUnique({ where: { slug }, select: { title: true } });
}
