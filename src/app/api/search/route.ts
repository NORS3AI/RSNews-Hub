import { NextResponse } from 'next/server';
import { smartSearch } from '@/lib/recommend';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Each query runs ILIKE '%…%' over the article table incl. the content column
  // (no index), so cap per-IP volume to blunt a scripted-flood DoS. Generous
  // enough (60/min) that a human's debounced typeahead is never throttled.
  const rl = rateLimit(`search:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ results: [] }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const limit = Math.min(30, Number(searchParams.get('limit') ?? 10) || 10);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const results = await smartSearch(q, limit);
  return NextResponse.json({
    results: results.map((r) => ({ id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt, category: r.category })),
  });
}
