// Vendor-dashboard review flow (queries). The admin pushes an article to a
// vendor's dashboard for review (one VendorReviewRequest row per push — the
// paper trail); the logged-in vendor answers Approve / Request changes once,
// which locks that row. Works for sponsored articles AND vendors' What's Hot
// pieces. The server actions (push / decide) live in lib/actions.

import { prisma } from './db';

export type VendorReviewCard = {
  id: string;
  createdAt: Date;
  decision: string | null;      // null = pending; 'approve' | 'change'
  message: string;
  decidedAt: Date | null;
  article: {
    id: string;
    title: string;
    slug: string;
    status: string;
    publishedAt: Date | null;
    sponsoredUntil: Date | null;
    previewToken: string | null;
  };
};

/** Every review round pushed to this vendor, newest first, with its article. */
export async function listVendorReviews(vendorId: string): Promise<VendorReviewCard[]> {
  if (!vendorId) return [];
  const rows = await prisma.vendorReviewRequest.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
    include: { article: { select: { id: true, title: true, slug: true, status: true, publishedAt: true, sponsoredUntil: true, previewToken: true } } },
  });
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt, decision: r.decision, message: r.message, decidedAt: r.decidedAt,
    article: r.article,
  }));
}

/**
 * Record a vendor's decision on a review round, atomically and once. The
 * updateMany guarded on `decidedAt: null` means only the FIRST response wins — a
 * double-click or a reopen-and-flip attempt returns false and changes nothing. On
 * success it also mirrors the decision into the admin Hub (an ArticleReview) so it
 * shows alongside link-reviewer feedback. Auth/ownership is the caller's job.
 */
export async function recordVendorDecision(opts: {
  requestId: string; articleId: string; decision: 'approve' | 'change'; message: string; firstName: string; lastName: string;
}): Promise<boolean> {
  const msg = opts.decision === 'change' ? opts.message : '';
  const locked = await prisma.vendorReviewRequest.updateMany({
    where: { id: opts.requestId, decidedAt: null },
    data: { decision: opts.decision, message: msg, decidedAt: new Date() },
  });
  if (locked.count === 0) return false; // already answered — no reopen/flip
  await prisma.articleReview.create({
    data: { articleId: opts.articleId, firstName: opts.firstName.slice(0, 80), lastName: opts.lastName.slice(0, 80), decision: opts.decision, message: msg },
  });
  return true;
}

export type PushTrailItem = { id: string; createdAt: Date; vendorId: string; vendorName: string; decision: string | null; decidedAt: Date | null; message: string };

/** The push history for one article (admin paper trail), newest first. */
export async function listArticlePushTrail(articleId: string): Promise<PushTrailItem[]> {
  const rows = await prisma.vendorReviewRequest.findMany({ where: { articleId }, orderBy: { createdAt: 'desc' } });
  if (!rows.length) return [];
  const vendorIds = [...new Set(rows.map((r) => r.vendorId))];
  const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } });
  const nameOf = new Map(vendors.map((v) => [v.id, v.name]));
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt, vendorId: r.vendorId, vendorName: nameOf.get(r.vendorId) || 'Unknown vendor',
    decision: r.decision, decidedAt: r.decidedAt, message: r.message,
  }));
}
