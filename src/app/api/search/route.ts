import { NextResponse } from 'next/server';
import { smartSearch } from '@/lib/recommend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const limit = Math.min(30, Number(searchParams.get('limit') ?? 10) || 10);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const results = await smartSearch(q, limit);
  return NextResponse.json({
    results: results.map((r) => ({ id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt, category: r.category })),
  });
}
