import { unstable_cache } from 'next/cache';
import { prisma } from './db';

// Information layer for the CMS "static page" route (privacy, terms, about, …).
// Returns the page only when it's PUBLISHED; null otherwise, which the page turns
// into notFound().
//
// Cached in Next's data cache (60s TTL) — these pages change rarely and are the
// same for every visitor. A publish/unpublish takes up to 60s to reflect, which
// is fine for legal/about pages.
export const getStaticPageData = unstable_cache(
  async (slug: string) => {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page || page.status !== 'PUBLISHED') return null;
    return page;
  },
  ['static-page-data'],
  { revalidate: 60, tags: ['reader-content'] },
);

export type StaticPageData = NonNullable<Awaited<ReturnType<typeof getStaticPageData>>>;

// Title lookup for generateMetadata — deliberately unfiltered by status (matches
// the original: a draft page still resolves its title for metadata).
export async function getStaticPageMeta(slug: string) {
  return prisma.page.findUnique({ where: { slug }, select: { title: true } });
}
