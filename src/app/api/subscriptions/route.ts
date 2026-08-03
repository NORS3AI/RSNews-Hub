import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  subscribeToArticle,
  unsubscribeFromArticle,
  subscribeToCategory,
  unsubscribeFromCategory,
} from '@/lib/subscriptions';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { articleId, categoryId } = await req.json().catch(() => ({}));
  if (articleId) subscribeToArticle(user.id, Number(articleId));
  if (categoryId) subscribeToCategory(user.id, Number(categoryId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { articleId, categoryId } = await req.json().catch(() => ({}));
  if (articleId) unsubscribeFromArticle(user.id, Number(articleId));
  if (categoryId) unsubscribeFromCategory(user.id, Number(categoryId));
  return NextResponse.json({ ok: true });
}
