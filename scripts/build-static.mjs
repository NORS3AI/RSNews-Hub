/**
 * Generates docs/data.js — a static snapshot of published content — for the
 * GitHub Pages preview site. Reads from the same database the app uses.
 *
 * Usage:  npm run build:static   (see package.json)
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'docs', 'data.js');

async function main() {
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      author: { select: { name: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } },
  });

  const industry = await prisma.industryLink.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { postedAt: 'desc' }],
  });

  const data = {
    generatedAt: new Date().toISOString(),
    industry: industry.map((l) => ({ id: l.id, title: l.title, url: l.url, source: l.source, views: l.views, postedAt: l.postedAt })),
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content: a.content,
      coverImage: a.coverImage,
      featured: a.featured,
      views: a.views,
      readMinutes: a.readMinutes,
      publishedAt: a.publishedAt,
      author: a.author?.name ?? null,
      category: a.category,
      tags: a.tags.map((t) => t.tag),
    })),
    categories: categories.map((c) => ({ name: c.name, slug: c.slug, color: c.color, count: c._count.articles })),
  };

  writeFileSync(OUT, 'window.__DATA__ = ' + JSON.stringify(data) + ';\n');
  console.log(`Wrote ${OUT}\n  ${data.articles.length} articles, ${data.categories.length} categories`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
