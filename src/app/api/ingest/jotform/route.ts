import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { captureError, log } from '@/lib/logger';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { ingestSubmission } from '@/lib/jotformIngest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cap the stored raw payload so a caller can't bloat the DB with giant bodies.
const MAX_RAW_BYTES = 512 * 1024;

// JotForm webhook receiver. Configure a JotForm webhook to
//   POST https://<hub>/api/ingest/jotform?key=<JOTFORM_WEBHOOK_SECRET>
// (or send the secret as the `x-jotform-token` header). Each submission is
// recorded (audit + raw), deduped on the JotForm submission id, and turned into
// a DRAFT campaign + inactive creatives for admin review. Nothing serves until
// the admin schedules a flight. See INTEGRATION.md.

function tokenMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: Request, url: URL): boolean {
  const secret = process.env.JOTFORM_WEBHOOK_SECRET;
  if (!secret) return false; // not configured → refuse (fail closed)
  const provided = url.searchParams.get('key') || req.headers.get('x-jotform-token') || '';
  return !!provided && tokenMatches(provided, secret);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!process.env.JOTFORM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'ingestion not configured' }, { status: 503 });
  }
  if (!authorized(req, url)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Blunt flooding / secret-guessing (best-effort, per-process).
  const rl = rateLimit(`ingest:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  // JotForm posts multipart/form-data with `rawRequest` (JSON), `submissionID`, `formID`.
  let rawRequest = '';
  let submissionId = '';
  let formId: string | null = null;
  try {
    const form = await req.formData();
    rawRequest = String(form.get('rawRequest') ?? '');
    submissionId = String(form.get('submissionID') ?? form.get('submissionId') ?? '');
    formId = form.get('formID') ? String(form.get('formID')) : null;
  } catch {
    return NextResponse.json({ ok: false, error: 'malformed body' }, { status: 400 });
  }
  if (!submissionId || !rawRequest) {
    return NextResponse.json({ ok: false, error: 'missing submissionID or rawRequest' }, { status: 400 });
  }
  if (Buffer.byteLength(rawRequest) > MAX_RAW_BYTES) {
    return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413 });
  }

  // Idempotency: claim the submission exactly once via the unique submissionId.
  // The first delivery creates the row (and processes); any concurrent or later
  // re-delivery hits the unique constraint and is treated as a dedup — so a
  // webhook retry can never spawn a second campaign, whatever the prior outcome.
  try {
    await prisma.adSubmission.create({ data: { submissionId, formId, raw: rawRequest, status: 'RECEIVED' } });
  } catch {
    const existing = await prisma.adSubmission.findUnique({ where: { submissionId }, select: { status: true, campaignId: true } });
    return NextResponse.json({ ok: true, deduped: true, status: existing?.status ?? 'RECEIVED', campaignId: existing?.campaignId ?? null });
  }

  let rawObj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawRequest);
    rawObj = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    await prisma.adSubmission.update({ where: { submissionId }, data: { status: 'FAILED', error: 'rawRequest is not valid JSON' } });
    return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }

  try {
    const result = await ingestSubmission(rawObj, submissionId);
    await prisma.adSubmission.update({
      where: { submissionId },
      data: { status: 'PROCESSED', vendorId: result.vendorId, campaignId: result.campaignId, error: result.parsed.issues.join('; ') || null },
    });
    log.info('jotform submission ingested', { submissionId, vendorId: result.vendorId, campaignId: result.campaignId, creatives: result.creatives });
    return NextResponse.json({ ok: true, campaignId: result.campaignId, creatives: result.creatives, issues: result.parsed.issues });
  } catch (e) {
    // Keep the detailed reason in the audit row + logs; return a generic message.
    await prisma.adSubmission.update({ where: { submissionId }, data: { status: 'FAILED', error: (e as Error).message } });
    captureError(e, { route: 'ingest/jotform' });
    // 200 so JotForm doesn't retry-storm; the failure is recorded for review.
    return NextResponse.json({ ok: false, error: 'processing failed' }, { status: 200 });
  }
}
