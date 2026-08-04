import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { siteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';
const base = siteUrl || 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories, tags, pages] = await Promise.all([
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: 'desc' }, take: 5000 }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.tag.findMany({ select: { slug: true } }),
    prisma.page.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
  ]);

  return [
    { url: `${base}/docs`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/docs/archive`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/docs/categories`, changeFrequency: 'weekly', priority: 0.5 },
    ...articles.map((a) => ({ url: `${base}/docs/article/${a.slug}`, lastModified: a.updatedAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: `${base}/docs/category/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...tags.map((t) => ({ url: `${base}/docs/tag/${t.slug}`, changeFrequency: 'weekly' as const, priority: 0.3 })),
    ...pages.map((p) => ({ url: `${base}/docs/page/${p.slug}`, lastModified: p.updatedAt, priority: 0.4 })),
  ];
}
