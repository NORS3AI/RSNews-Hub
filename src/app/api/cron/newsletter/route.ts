import { NextResponse } from 'next/server';
import { sendDigest } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// Daily digest trigger for the host's scheduler. Protect with CRON_SECRET:
//   POST /api/cron/newsletter  with header  Authorization: Bearer <CRON_SECRET>
//   (or ?secret=<CRON_SECRET>). If CRON_SECRET is unset, the endpoint is disabled.
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron disabled (set CRON_SECRET)' }, { status: 503 });
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const given = auth.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret') || '';
  if (given !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await sendDigest();
  return NextResponse.json(r);
}
export async function POST(req: Request) { return run(req); }
export async function GET(req: Request) { return run(req); }
