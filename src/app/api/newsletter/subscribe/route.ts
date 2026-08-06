import { NextResponse } from 'next/server';
import { subscribeEmail } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// Public: open email capture for the daily Industry News digest.
export async function POST(req: Request) {
  let email = '';
  try { const b = await req.json(); email = String(b.email || ''); } catch { /* ignore */ }
  const r = await subscribeEmail(email, 'homepage');
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
