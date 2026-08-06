import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendDailyDigests } from '@/lib/newsletter';
import { recordJobRun } from '@/lib/jobHealth';

export const dynamic = 'force-dynamic';

// Constant-time equality so the secret can't be recovered by timing the compare.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Daily digest trigger for the host's scheduler. Protect with CRON_SECRET:
//   POST /api/cron/newsletter  with header  Authorization: Bearer <CRON_SECRET>
//   (or ?secret=<CRON_SECRET>). If CRON_SECRET is unset, the endpoint is disabled.
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron disabled (set CRON_SECRET)' }, { status: 503 });
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  // Prefer the Authorization header; the ?secret= fallback exists for schedulers
  // that can't set headers (note: query strings can land in logs).
  const given = auth.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret') || '';
  if (!safeEqual(given, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await sendDailyDigests();
  await recordJobRun('newsletter', r);
  return NextResponse.json(r);
}
export async function POST(req: Request) { return run(req); }
export async function GET(req: Request) { return run(req); }
