import { NextResponse } from 'next/server';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { recordEvents, deviceFromUA } from '@/lib/analytics/record';
import { captureError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Ingestion endpoint. Accepts a batch: { events: ClientEvent[] }. Designed for
// navigator.sendBeacon, so it returns fast and never throws to the caller.
export async function POST(req: Request) {
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
