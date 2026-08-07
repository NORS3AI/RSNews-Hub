import { prisma } from './db';
import { getAdapter, audioKey } from './storage';
import { articleToSpeech, speechHash } from './articleSpeech';
import { elevenLabsConfigured, synthesizeSpeech } from './elevenlabs';
import { captureError, log } from './logger';

// "Listen to article" pipeline: clean an article's HTML to speakable text,
// synthesize it with ElevenLabs, store the MP3, and attach the URL to the row.
// Generation runs in the background after publish and is idempotent — audio is
// only (re)made when the spoken text's fingerprint changes. If no ElevenLabs key
// is configured the whole thing no-ops safely (articles just stay PENDING until a
// key is added, and no Listen button ever appears).

type Eligible = { status: string; requirement: string };
// Only published, ungated articles get audio — a gated article's MP3 would sit
// at a public URL, which must not leak restricted content.
export function audioEligible(a: Eligible): boolean {
  return a.status === 'PUBLISHED' && (!a.requirement || a.requirement === 'public');
}

/** Reconcile an article's audio state after a save. Marks it PENDING when its
 *  spoken text is new/changed (and it's eligible), or NONE when it isn't
 *  eligible. Does not itself call ElevenLabs — the caller fires generation. */
export async function reconcileArticleAudio(id: string): Promise<'PENDING' | 'NONE' | 'CURRENT'> {
  const a = await prisma.article.findUnique({ where: { id }, select: { content: true, title: true, status: true, requirement: true, audioHash: true, audioStatus: true } });
  if (!a) return 'NONE';
  if (!audioEligible(a)) {
    if (a.audioStatus !== 'NONE') await prisma.article.update({ where: { id }, data: { audioStatus: 'NONE' } });
    return 'NONE';
  }
  const hash = speechHash(articleToSpeech(a.content, a.title));
  if (a.audioHash === hash && a.audioStatus === 'READY') return 'CURRENT';
  await prisma.article.update({ where: { id }, data: { audioStatus: 'PENDING' } });
  return 'PENDING';
}

/** Generate (or refresh) one article's audio. Safe to call anytime: it re-checks
 *  eligibility, skips when the current audio already matches, and no-ops when
 *  ElevenLabs isn't configured (leaving the row PENDING for a later run). */
export async function generateArticleAudio(id: string): Promise<'ready' | 'skipped' | 'failed' | 'unconfigured'> {
  const a = await prisma.article.findUnique({ where: { id }, select: { content: true, title: true, status: true, requirement: true, audioHash: true, audioStatus: true, audioUrl: true } });
  if (!a) return 'skipped';
  if (!audioEligible(a)) { if (a.audioStatus !== 'NONE') await prisma.article.update({ where: { id }, data: { audioStatus: 'NONE' } }); return 'skipped'; }

  const text = articleToSpeech(a.content, a.title);
  const hash = speechHash(text);
  if (a.audioHash === hash && a.audioStatus === 'READY' && a.audioUrl) return 'skipped'; // already current
  if (!elevenLabsConfigured()) return 'unconfigured'; // leave PENDING for when a key exists

  try {
    const mp3 = await synthesizeSpeech(text);
    const key = audioKey(mp3);
    await getAdapter().put(key, mp3, 'audio/mpeg');
    await prisma.article.update({ where: { id }, data: { audioUrl: getAdapter().publicUrl(key), audioStatus: 'READY', audioHash: hash, audioUpdatedAt: new Date() } });
    log.info('article audio ready', { id, bytes: mp3.length });
    return 'ready';
  } catch (e) {
    captureError(e, { route: 'articleAudio', id });
    await prisma.article.update({ where: { id }, data: { audioStatus: 'FAILED' } });
    return 'failed';
  }
}

export type AudioBatchSummary = { configured: boolean; pending: number; ready: number; failed: number };

/** Process a batch of PENDING articles (the cron worker). Bounded per run to
 *  keep cost/time in check; the next run picks up the rest. */
export async function generatePendingAudio(limit = 8): Promise<AudioBatchSummary> {
  const pending = await prisma.article.findMany({
    where: { status: 'PUBLISHED', audioStatus: 'PENDING' },
    orderBy: { publishedAt: 'desc' }, take: limit, select: { id: true },
  });
  if (!elevenLabsConfigured()) return { configured: false, pending: pending.length, ready: 0, failed: 0 };
  let ready = 0, failed = 0;
  for (const { id } of pending) {
    const r = await generateArticleAudio(id);
    if (r === 'ready') ready++; else if (r === 'failed') failed++;
  }
  return { configured: true, pending: pending.length, ready, failed };
}
