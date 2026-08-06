import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sendDigest } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// Staff: send today's digest to all active subscribers now (skips if nothing new).
export async function POST() {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await sendDigest();
  return NextResponse.json(r);
}
