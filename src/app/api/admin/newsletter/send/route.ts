import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sendDailyDigests } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// Staff: send each subscriber their personalized digest now (skips empties).
export async function POST() {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await sendDailyDigests();
  return NextResponse.json(r);
}
