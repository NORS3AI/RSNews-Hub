import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchLinkMeta } from '@/lib/linkMeta';

export const dynamic = 'force-dynamic';

// Staff-only: pull a headline / source / date out of a pasted news URL so the
// Industry News quick-add can fill itself in.
export async function GET(req: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url).searchParams.get('url') || '';
  if (!url) return NextResponse.json({ error: 'Paste a link first.' }, { status: 400 });
  const meta = await fetchLinkMeta(url);
  if ('error' in meta) return NextResponse.json({ error: meta.error }, { status: 200 });
  return NextResponse.json({ meta });
}
