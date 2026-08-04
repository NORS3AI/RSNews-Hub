import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';

// Records that an article was read (dedupes within a short window) and bumps views.
export async function POST(req: Request) {
  const { articleId } = await req.json().catch(() => ({ articleId: null }));
  if (!articleId) return NextResponse.json({ error: 'articleId required' }, { status: 400 });

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true, status: true } });
  if (!article || article.status !== 'PUBLISHED') return NextResponse.json({ ok: false }, { status: 404 });

  const user = await getSessionUser();
  const sessionId = await getReaderSessionId();
  const key = user ? { userId: user.id } : sessionId ? { sessionId } : null;

  if (key) {
    const recent = await prisma.readingLog.findFirst({
      where: { articleId, ...key, readAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
    });
    if (!recent) {
      await prisma.readingLog.create({ data: { articleId, userId: user?.id ?? null, sessionId: user ? null : sessionId } });
      await prisma.article.update({ where: { id: articleId }, data: { views: { increment: 1 } } });
    }
  }
  return NextResponse.json({ ok: true });
}
