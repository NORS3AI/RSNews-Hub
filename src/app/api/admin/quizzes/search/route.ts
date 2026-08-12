import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Staff-only typeahead for the Module Studio's "pick a quiz" control.
// `?q=` searches quiz titles; `?id=` resolves a single quiz's label.
export async function GET(req: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const q = (url.searchParams.get('q') || '').trim();
  const select = { id: true, title: true } as const;

  if (id) {
    const quiz = await prisma.quiz.findUnique({ where: { id }, select });
    return NextResponse.json({ items: quiz ? [{ id: quiz.id, label: quiz.title }] : [] });
  }
  const rows = await prisma.quiz.findMany({
    where: q ? { title: { contains: q, mode: 'insensitive' as const } } : {},
    orderBy: { createdAt: 'desc' },
    take: 15,
    select,
  });
  return NextResponse.json({ items: rows.map((qz) => ({ id: qz.id, label: qz.title })) });
}
