import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canViewContent } from '@/lib/entitlements';
import { parseJson } from '@/lib/http';
import { toggleRecommend } from '@/lib/articleRecommend';

// Toggle the signed-in reader's "Recommend" on an article and return the fresh
// count + state. Recommending REQUIRES an account (one human = one account = one
// recommend) so the count is a trustworthy, un-gameable ranking signal — an
// anonymous reader can't rotate a cookie to inflate it. Same access rules as
// /api/reading otherwise: a scheduled or gated article can't be recommended by
// someone who can't actually read it.
export async function POST(req: Request) {
  const parsed = await parseJson(req, z.object({ articleId: z.string().min(1) }));
  if (!parsed.ok) return parsed.res;
  const { articleId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'sign-in-required' }, { status: 401 });

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, status: true, requirement: true, publishedAt: true },
  });
  if (!article || article.status !== 'PUBLISHED') return NextResponse.json({ ok: false }, { status: 404 });
  if (article.publishedAt && article.publishedAt > new Date()) return NextResponse.json({ ok: false }, { status: 404 });
  if (!canViewContent(user, article.requirement)) return NextResponse.json({ ok: false }, { status: 403 });

  const state = await toggleRecommend(articleId, { userId: user.id });
  return NextResponse.json({ ok: true, ...state });
}
