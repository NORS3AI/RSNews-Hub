import { NextResponse } from 'next/server';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { recordEvents, deviceFromUA } from '@/lib/analytics/record';
import { captureError } from '@/lib/logger';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Ingestion endpoint. Accepts a batch: { events: ClientEvent[] }. Designed for
// navigator.sendBeacon, so it returns fast and never throws to the caller.
export async function POST(req: Request) {
  // The endpoint is unauthenticated by design (anonymous readers generate events),
  // and the caller controls the event props (incl. ad campaign/brand attribution),
  // so a flooder could bulk-insert rows to skew advertiser reports. Rate-limit per
  // IP to blunt that — generous enough (up to 60 events/request) not to drop real
  // beacons. Reconciling client-claimed ad attribution server-side is a deeper
  // follow-up; this caps the volume.
  const rl = rateLimit(`collect:${clientIp(req)}`, 300, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  let events: unknown = [];
  try {
    const body = await req.json();
    events = body?.events ?? [];
  } catch { /* ignore malformed beacons */ }

  const [user, visitorId] = await Promise.all([getSessionUser(), getReaderSessionId()]);
  try {
    const n = await recordEvents(events, {
      visitorId: visitorId ?? null,
      userId: user?.id ?? null,
      device: deviceFromUA(req.headers.get('user-agent')),
    });
    return NextResponse.json({ ok: true, stored: n });
  } catch (e) {
    captureError(e, { route: 'analytics/collect' });
    return NextResponse.json({ ok: false }, { status: 200 }); // never surface errors to the page
  }
}
