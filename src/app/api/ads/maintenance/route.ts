import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { advanceLifecycle } from '@/lib/campaigns';
import { sendDueReminders } from '@/lib/adReminders';
import { sweepSponsorGoLiveNotifications } from '@/lib/intake';
import { recordJobRun } from '@/lib/jobHealth';
import { captureError, log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Nightly ad-campaign maintenance: end elapsed flights, complete finished
// campaigns, and flag flights whose fresh creatives are due soon (vendor
// reminders — email delivery is wired in a later phase). Authorize with an admin
// session OR `Authorization: Bearer <CRON_SECRET>`. Idempotent. Note: serving
// already respects flight windows, so this is bookkeeping + reminders, not what
// takes an ad down.
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

export async function POST(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    const now = new Date();
    const lifecycle = await advanceLifecycle(now);
    const reminders = await sendDueReminders(now);
    // Backstop: notify sponsors whose SCHEDULED article has since gone live (the
    // low-latency trigger is the opportunistic homepage sweep).
    const sponsorGoLive = await sweepSponsorGoLiveNotifications();
    await recordJobRun('ads-maintenance', { ...lifecycle, ...reminders, sponsorGoLive });
    log.info('ad maintenance complete', { ...lifecycle, ...reminders, sponsorGoLive });
    return NextResponse.json({ ok: true, ...lifecycle, ...reminders, sponsorGoLive });
  } catch (e) {
    captureError(e, { route: 'ads/maintenance' });
    return NextResponse.json({ ok: false, error: 'maintenance failed' }, { status: 500 });
  }
}
