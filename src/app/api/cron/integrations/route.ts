import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { runIntegrationsMonitor } from '@/lib/integrationsMonitor';
import { recordJobRun } from '@/lib/jobHealth';
import { captureError, log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Unattended integration monitor: runs the live health checks, remembers the
// result, and emails admins when a connection goes down (or recovers). Meant to
// be hit on a schedule (nightly.yml / any host scheduler). Auth: an admin session
// OR `Authorization: Bearer <CRON_SECRET>`.
function secretMatches(header: string, secret: string): boolean {
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && secretMatches(req.headers.get('authorization') || '', secret)) return true;
  return !!(await requireAdmin());
}

async function run(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    const summary = await runIntegrationsMonitor();
    await recordJobRun('integrations-check', summary);
    log.info('integrations monitor complete', summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    captureError(e, { route: 'cron/integrations' });
    return NextResponse.json({ ok: false, error: 'monitor failed' }, { status: 500 });
  }
}
export async function POST(req: Request) { return run(req); }
export async function GET(req: Request) { return run(req); }
