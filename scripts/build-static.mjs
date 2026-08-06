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
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      extraCategories: { select: { name: true, slug: true, color: true } },
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

  const polls = await prisma.poll.findMany({
    orderBy: { createdAt: 'desc' },
    include: { options: { orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } } },
  });

  const comics = await prisma.comic.findMany({ orderBy: [{ order: 'asc' }, { postedAt: 'desc' }] });

  // Active Pop Quiz for the preview. Correct flags are intentionally omitted so
  // the answers never reach the client. The static demo can't collect real
  // responses, so we refresh closesAt to build-time + 44h each build to keep the
  // countdown live in the snapshot.
  const activeQuiz = await prisma.quiz.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
    include: { questions: { orderBy: { order: 'asc' }, select: { id: true, prompt: true, options: { orderBy: { order: 'asc' }, select: { id: true, label: true } } } } },
  });
  const quiz = activeQuiz ? {
    id: activeQuiz.id, title: activeQuiz.title,
    closesAt: new Date(Date.now() + 44 * 3600_000).toISOString(),
    questions: activeQuiz.questions,
  } : null;

  const data = {
    generatedAt: new Date().toISOString(),
    industry: industry.map((l) => ({ id: l.id, title: l.title, url: l.url, source: l.source, author: l.author, views: l.views, postedAt: l.postedAt })),
    // Relativize root-absolute asset paths so they resolve under the Pages subpath
    // (data: URLs and full http(s) URLs pass through unchanged).
    comics: comics.map((c) => ({ id: c.id, title: c.title, image: c.image.startsWith('/') ? c.image.slice(1) : c.image, caption: c.caption, active: c.active, postedAt: c.postedAt })),
    polls: polls.map((p) => ({ id: p.id, question: p.question, active: p.active, closesAt: p.closesAt, createdAt: p.createdAt,
      options: p.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes })) })),
    quiz,
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content: a.content,
      // Relativize root-absolute cover paths for the Pages subpath (data/http URLs pass through).
      coverImage: a.coverImage && a.coverImage.startsWith('/') ? a.coverImage.slice(1) : a.coverImage,
      featured: a.featured,
      views: a.views,
      readMinutes: a.readMinutes,
      publishedAt: a.publishedAt,
      author: a.author?.name ?? null,
      category: a.category,
      extraCategories: a.extraCategories,
      // ISO expiry for the Breaking badge; the static snapshot compares to now.
      breakingUntil: a.breakingUntil ? a.breakingUntil.toISOString() : null,
      tags: a.tags.map((t) => t.tag),
    })),
    categories: categories.map((c) => ({ name: c.name, slug: c.slug, color: c.color, count: c._count.articles })),
  };

  writeFileSync(OUT, 'window.__DATA__ = ' + JSON.stringify(data) + ';\n');
  console.log(`Wrote ${OUT}\n  ${data.articles.length} articles, ${data.categories.length} categories`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
