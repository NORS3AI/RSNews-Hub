import { NextResponse } from 'next/server';
import { getCategoryData } from '@/lib/categoryData';
import { categoryManifest } from '@/lib/manifest';

export const dynamic = 'force-dynamic';

// The render manifest as JSON — a category page as pure, UI-agnostic data. This
// is the headless seam: a native app or an AI-composed frontend fetches this and
// draws its own UI, never touching the database or the React components. Same
// bundle that feeds the on-site pages (getCategoryData → categoryManifest), so it
// can't drift. Public read-only, matching the public category page.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = await getCategoryData(slug);
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(categoryManifest(data));
}
