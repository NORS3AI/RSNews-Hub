import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sendTestTo } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// Staff: send a sample digest to one address to confirm SendGrid works.
export async function POST(req: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let email = '';
  try { const b = await req.json(); email = String(b.email || ''); } catch { /* ignore */ }
  const r = await sendTestTo(email);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
