import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, getReaderSessionId } from '@/lib/auth';
import { canViewContent } from '@/lib/entitlements';
import { parseJson } from '@/lib/http';
import { toggleRecommend, getRecommendState, recommendKey } from '@/lib/articleRecommend';

// Toggle the current reader's "Recommend" on an article and return the fresh
// count + state. Mirrors /api/reading's access rules: a scheduled or gated
// article can't be recommended by someone who can't actually read it.
export async function POST(req: Request) {
  const parsed = await parseJson(req, z.object({ articleId: z.string().min(1) }));
  if (!parsed.ok) return parsed.res;
  const { articleId } = parsed.data;

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, status: true, requirement: true, publishedAt: true },
  });
  if (!article || article.status !== 'PUBLISHED') return NextResponse.json({ ok: false }, { status: 404 });
  if (article.publishedAt && article.publishedAt > new Date()) return NextResponse.json({ ok: false }, { status: 404 });

  const user = await getCurrentUser();
  if (!canViewContent(user, article.requirement)) return NextResponse.json({ ok: false }, { status: 403 });

  const sessionId = await getReaderSessionId();
  const key = recommendKey(user?.id, sessionId);
  // No account and no reader-session → we can't dedup, so we don't record it
  // (but we still hand back the current count so the UI can render).
  if (!key) {
    const state = await getRecommendState(articleId, null);
    return NextResponse.json({ ok: true, ...state });
  }
  const state = await toggleRecommend(articleId, key);
  return NextResponse.json({ ok: true, ...state });
}
