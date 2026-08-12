import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RECOMMENDABLE_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const PAGE = 12;

// Feeds the homepage's endless "Keep scrolling" section: recommendable articles
// (published + archived), newest→oldest, paginated by offset. Returns one extra
// row to detect the end without a second query.
const cardSelect = {
  id: true, title: true, slug: true, excerpt: true, coverImage: true, coverFocus: true,
  publishedAt: true, views: true, readMinutes: true, requirement: true, genre: true, breakingUntil: true,
  category: { select: { name: true, slug: true, color: true } },
  extraCategories: { select: { name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;

export async function GET(req: Request) {
  const offset = Math.max(0, Math.min(5000, Number(new URL(req.url).searchParams.get('offset')) || 0));
  const rows = await prisma.article.findMany({
    where: { status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() } },
    orderBy: [{ publishedAt: 'desc' }],
    skip: offset,
    take: PAGE + 1,
    select: cardSelect,
  });
  const done = rows.length <= PAGE;
  const items = rows.slice(0, PAGE).map((a) => ({ ...a, tags: (a.tags ?? []).map((t) => t.tag) }));
  return NextResponse.json({ items, done });
}
