// Draft preview + approval helpers. A private per-article `previewToken` unlocks
// the full reader view of an unpublished article via a shareable link; reviewers
// (not logged in) leave an Approve / Request-changes response that aggregates in
// the Hub. A change request that isn't resolved keeps the article in "Changes
// requested"; otherwise approvals show.

import { randomBytes } from 'crypto';
import { prisma } from './db';

/** A URL-safe, unguessable preview secret. */
export function newPreviewToken(): string {
  return randomBytes(24).toString('base64url');
}

/** The article's preview token, generating + persisting one on first use. */
export async function ensurePreviewToken(articleId: string): Promise<string> {
  const a = await prisma.article.findUnique({ where: { id: articleId }, select: { previewToken: true } });
  if (a?.previewToken) return a.previewToken;
  const token = newPreviewToken();
  await prisma.article.update({ where: { id: articleId }, data: { previewToken: token } });
  return token;
}

export type ReviewDecision = 'approve' | 'change';
export type ReviewStatus = 'none' | 'approved' | 'changes';

/** Aggregate rule: an unresolved change request wins; else any approval shows. */
export function reviewStatus(reviews: { decision: string; resolved: boolean }[]): ReviewStatus {
  if (reviews.some((r) => r.decision === 'change' && !r.resolved)) return 'changes';
  if (reviews.some((r) => r.decision === 'approve')) return 'approved';
  return 'none';
}

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  none: 'Awaiting review',
  approved: 'Approved',
  changes: 'Changes requested',
};
