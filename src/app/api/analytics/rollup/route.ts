import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { rollupDays, recentDayKeys, pruneOldEvents, retentionDays } from '@/lib/analytics/rollup';
import { captureError, log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Nightly maintenance: rebuild recent daily rollups, then prune raw events past
// the retention window. Authorize with EITHER an admin session (manual "rebuild"
// button) OR a `Authorization: Bearer <CRON_SECRET>` header (host scheduler).
//
// Host cron example (Vercel cron / Railway / GH Actions):
//   curl -X POST https://SITE/api/analytics/rollup -H "Authorization: Bearer $CRON_SECRET"
//
// Re-rolls the last 3 days (not just yesterday) so late-arriving beacons are
// captured. Idempotent — safe to run repeatedly.
async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth === `Bearer ${secret}`) return true;
  }
  return !!(await requireAdmin());
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 3, 1), 90);
    const keys = recentDayKeys(new Date(), days);
    await rollupDays(keys);
    const { pruned, cutoff } = await pruneOldEvents(new Date());
    log.info('analytics rollup complete', { days, rolledUp: keys.length, pruned, retentionDays: retentionDays() });
    return NextResponse.json({ ok: true, rolledUp: keys, pruned, cutoff, retentionDays: retentionDays() });
  } catch (e) {
    captureError(e, { route: 'analytics/rollup' });
    return NextResponse.json({ ok: false, error: 'rollup failed' }, { status: 500 });
  }
}
