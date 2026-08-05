import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { parseJson } from '@/lib/http';

// Toggle a subscription. categoryId null = subscribe to ALL articles.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to subscribe.' }, { status: 401 });

  const parsed = await parseJson(req, z.object({ categoryId: z.string().min(1).nullish() }));
  if (!parsed.ok) return parsed.res;
  const catId: string | null = parsed.data.categoryId ?? null;

  // findFirst (not findUnique) because SQLite treats NULL != NULL, so the
  // compound unique key can't match the "all articles" (null category) row.
  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id, categoryId: catId },
  });

  if (existing) {
    await prisma.subscription.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, subscribed: false });
  }
  await prisma.subscription.create({ data: { userId: user.id, categoryId: catId } });
  return NextResponse.json({ ok: true, subscribed: true });
}
