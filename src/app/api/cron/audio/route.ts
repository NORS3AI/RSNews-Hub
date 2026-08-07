import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { generatePendingAudio } from '@/lib/articleAudio';
import { recordJobRun } from '@/lib/jobHealth';
import { captureError, log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Batch generator for "Listen to article" audio: finds published articles marked
// PENDING and synthesizes their MP3s (safety net for the after-publish background
// job — catches failures, restarts, and articles published before a key existed).
// A no-op when ElevenLabs isn't configured. Auth: admin session OR
// `Authorization: Bearer <CRON_SECRET>`.
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
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 8, 1), 50);
    const summary = await generatePendingAudio(limit);
    await recordJobRun('article-audio', summary);
    log.info('article audio batch complete', summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    captureError(e, { route: 'cron/audio' });
    return NextResponse.json({ ok: false, error: 'audio batch failed' }, { status: 500 });
  }
}
