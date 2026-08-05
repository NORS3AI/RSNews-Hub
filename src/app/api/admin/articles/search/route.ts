import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Staff-only typeahead for the Module Studio's "hand-pick an article" control.
// `?q=` searches published titles; `?id=` resolves a single article's label.
export async function GET(req: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const q = (url.searchParams.get('q') || '').trim();
  const select = { id: true, title: true, slug: true } as const;

  if (id) {
    const a = await prisma.article.findUnique({ where: { id }, select });
    return NextResponse.json({ articles: a ? [a] : [] });
  }
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED', ...(q ? { title: { contains: q } } : {}) },
    orderBy: { publishedAt: 'desc' },
    take: 15,
    select,
  });
  return NextResponse.json({ articles });
}
