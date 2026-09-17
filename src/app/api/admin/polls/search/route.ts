import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Staff-only typeahead for the Module Studio's "pick a poll" control.
// `?q=` searches poll questions; `?id=` resolves a single poll's label.
export async function GET(req: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const q = (url.searchParams.get('q') || '').trim();
  const select = { id: true, question: true } as const;

  if (id) {
    const poll = await prisma.poll.findUnique({ where: { id }, select });
    return NextResponse.json({ items: poll ? [{ id: poll.id, label: poll.question }] : [] });
  }
  const rows = await prisma.poll.findMany({
    where: q ? { question: { contains: q, mode: 'insensitive' as const } } : {},
    orderBy: { createdAt: 'desc' },
    take: 15,
    select,
  });
  return NextResponse.json({ items: rows.map((p) => ({ id: p.id, label: p.question })) });
}
