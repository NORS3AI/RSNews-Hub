import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, getReaderSessionId } from '@/lib/auth';
import { canViewContent } from '@/lib/entitlements';
import { parseJson } from '@/lib/http';

// Records that an article was read (dedupes within a short window) and bumps views.
export async function POST(req: Request) {
  const parsed = await parseJson(req, z.object({ articleId: z.string().min(1) }));
  if (!parsed.ok) return parsed.res;
  const { articleId } = parsed.data;

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true, status: true, requirement: true } });
  if (!article || article.status !== 'PUBLISHED') return NextResponse.json({ ok: false }, { status: 404 });

  // Don't log a read or bump views for content the caller can't actually access
  // (keeps the "no read tracked for gated content" invariant, and stops a locked
  // article's views being inflated by a raw POST).
  const user = await getCurrentUser();
  if (!canViewContent(user, article.requirement)) return NextResponse.json({ ok: false }, { status: 403 });

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
