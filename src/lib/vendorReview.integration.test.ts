// Integration tests for the vendor-dashboard review flow. They hit the DB and
// lock in the two guarantees that matter: a decision locks the row so it can't be
// reopened or flipped (only the first response wins), and each decision mirrors
// into the admin Hub as an ArticleReview. Rows are cleaned up after each test.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import { recordVendorDecision, listVendorReviews, listArticlePushTrail } from './vendorReview';

let seq = 0;
const tag = () => `vrr${Date.now().toString(36)}${seq++}`;

const madeArticles: string[] = [];
const madeVendors: string[] = [];

afterEach(async () => {
  if (madeArticles.length) await prisma.article.deleteMany({ where: { id: { in: madeArticles } } });
  if (madeVendors.length) await prisma.vendor.deleteMany({ where: { id: { in: madeVendors } } });
  madeArticles.length = 0; madeVendors.length = 0;
});

async function seed() {
  const a = await prisma.article.create({ data: { title: `T ${tag()}`, slug: `s-${tag()}`, content: '<p>x</p>', status: 'DRAFT' }, select: { id: true } });
  madeArticles.push(a.id);
  const name = `Vendor ${tag()}`;
  const v = await prisma.vendor.create({ data: { name, brandKey: `bk-${tag()}` }, select: { id: true, name: true } });
  madeVendors.push(v.id);
  const req = await prisma.vendorReviewRequest.create({ data: { articleId: a.id, vendorId: v.id }, select: { id: true } });
  return { articleId: a.id, vendorId: v.id, vendorName: v.name, requestId: req.id };
}

describe('recordVendorDecision', () => {
  it('records the first decision, locks the row, and mirrors an ArticleReview', async () => {
    const s = await seed();
    const ok = await recordVendorDecision({ requestId: s.requestId, articleId: s.articleId, decision: 'change', message: 'Fix the intro', firstName: 'Dana', lastName: `(${s.vendorName})` });
    expect(ok).toBe(true);

    const row = await prisma.vendorReviewRequest.findUnique({ where: { id: s.requestId }, select: { decision: true, decidedAt: true, message: true } });
    expect(row?.decision).toBe('change');
    expect(row?.decidedAt).toBeTruthy();
    expect(row?.message).toBe('Fix the intro');

    const mirror = await prisma.articleReview.findFirst({ where: { articleId: s.articleId } });
    expect(mirror?.decision).toBe('change');
    expect(mirror?.message).toBe('Fix the intro');
    expect(mirror?.lastName).toContain(s.vendorName);
  });

  it('locks: a second decision is rejected and cannot flip the first', async () => {
    const s = await seed();
    expect(await recordVendorDecision({ requestId: s.requestId, articleId: s.articleId, decision: 'approve', message: '', firstName: 'D', lastName: '(v)' })).toBe(true);
    // attempt to flip approve → change
    expect(await recordVendorDecision({ requestId: s.requestId, articleId: s.articleId, decision: 'change', message: 'nope', firstName: 'D', lastName: '(v)' })).toBe(false);

    const row = await prisma.vendorReviewRequest.findUnique({ where: { id: s.requestId }, select: { decision: true } });
    expect(row?.decision).toBe('approve'); // unchanged
    const mirrors = await prisma.articleReview.count({ where: { articleId: s.articleId } });
    expect(mirrors).toBe(1); // only the first wrote a Hub review
  });

  it('an approve stores no change message', async () => {
    const s = await seed();
    await recordVendorDecision({ requestId: s.requestId, articleId: s.articleId, decision: 'approve', message: 'ignored', firstName: 'D', lastName: '(v)' });
    const row = await prisma.vendorReviewRequest.findUnique({ where: { id: s.requestId }, select: { message: true } });
    expect(row?.message).toBe('');
  });

  it('a re-push creates a new pending round; the old decided one is preserved', async () => {
    const s = await seed();
    await recordVendorDecision({ requestId: s.requestId, articleId: s.articleId, decision: 'change', message: 'round 1', firstName: 'D', lastName: '(v)' });
    // admin pushes again
    await prisma.vendorReviewRequest.create({ data: { articleId: s.articleId, vendorId: s.vendorId } });

    const cards = await listVendorReviews(s.vendorId);
    expect(cards.length).toBe(2);
    expect(cards.filter((c) => c.decidedAt).length).toBe(1);   // old round still locked
    expect(cards.filter((c) => !c.decidedAt).length).toBe(1);  // new round pending

    const trail = await listArticlePushTrail(s.articleId);
    expect(trail.length).toBe(2);
    expect(trail[0].vendorName).toBe(s.vendorName);
  });
});
