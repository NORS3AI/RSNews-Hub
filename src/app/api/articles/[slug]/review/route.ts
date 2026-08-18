import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/http';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { moderateText } from '@/lib/moderation';

// Constant-time token equality (length-checked) — matches the ingest/cron paths.
function tokenMatches(stored: string | null, given: string): boolean {
  if (!stored) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Public (unauthenticated) endpoint: an invited reviewer submits an approval or a
// change request on a DRAFT preview. The preview TOKEN is the access control — a
// caller must already hold the private link. Rate-limited + moderated so it can't
// be used to spam the Hub.
const Schema = z.object({
  token: z.string().min(1).max(200),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  decision: z.enum(['approve', 'change']),
  message: z.string().max(8000).optional().default(''),
});

const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 60);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rl = rateLimit(`review:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many submissions. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  const parsed = await parseJson(req, Schema);
  if (!parsed.ok) return parsed.res;
  const { token, decision } = parsed.data;
  const { slug } = await params;

  const article = await prisma.article.findUnique({ where: { slug }, select: { id: true, title: true, previewToken: true, status: true, publishedAt: true } });
  // Token is the gate — a wrong/absent token reveals nothing.
  if (!article || !tokenMatches(article.previewToken, token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Reviews are a PRE-publish step. Once the piece is publicly live (or archived),
  // stop accepting token feedback — the non-rotating token would otherwise let a
  // link-holder keep posting spoofed review rows against a live article forever.
  const nowTs = new Date();
  const isLivePublic =
    article.status === 'ARCHIVED' ||
    (article.status === 'PUBLISHED' && (!article.publishedAt || article.publishedAt <= nowTs));
  if (isLivePublic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const firstName = cleanName(parsed.data.firstName);
  const lastName = cleanName(parsed.data.lastName);
  if (!firstName || !lastName) return NextResponse.json({ error: 'Please enter your first and last name.' }, { status: 400 });

  let message = '';
  if (decision === 'change') {
    const mod = moderateText(parsed.data.message, { maxLength: 8000, allowLinks: false });
    if (mod.verdict === 'block') return NextResponse.json({ error: 'Please describe the change you’d like (without links).' }, { status: 400 });
    message = mod.cleaned;
  }

  await prisma.articleReview.create({ data: { articleId: article.id, firstName, lastName, decision, message } });
  await prisma.adminLog.create({
    data: { kind: 'article_review', message: `${firstName} ${lastName} ${decision === 'approve' ? 'approved' : 'requested changes to'} “${article.title}”` },
  });

  return NextResponse.json({ ok: true });
}
