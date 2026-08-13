// Integration tests for the intake admin operations: confirming a held vendor
// (confirm-before-merge → bind) and the stage-two go-live notify. These hit the
// DB and clean up after themselves.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import { brandKey } from './entitlements';
import { resolveIntakeVendor, notifySponsorLive } from './intake';

let seq = 0;
const tag = () => `iit${Date.now().toString(36)}${seq++}`;

const madeArticles: string[] = [];
const madeVendors: string[] = [];
const madeSubs: string[] = [];

afterEach(async () => {
  if (madeArticles.length) await prisma.article.deleteMany({ where: { id: { in: madeArticles } } });
  if (madeSubs.length) await prisma.contentSubmission.deleteMany({ where: { submissionId: { in: madeSubs } } });
  if (madeVendors.length) await prisma.vendor.deleteMany({ where: { id: { in: [...new Set(madeVendors)] } } });
  await prisma.adminLog.deleteMany({ where: { kind: 'sponsor_golive' } });
  madeArticles.length = 0; madeVendors.length = 0; madeSubs.length = 0;
});

async function mkDraft(over: Record<string, unknown> = {}) {
  const a = await prisma.article.create({
    data: { title: `T ${tag()}`, slug: `s-${tag()}`, content: '<p>x</p>', status: 'DRAFT', genre: 'sponsored', ...over },
    select: { id: true },
  });
  madeArticles.push(a.id);
  return a.id;
}

describe('resolveIntakeVendor', () => {
  it('binds a held submission + its draft to the chosen existing vendor', async () => {
    const name = `HeldCo ${tag()}`;
    const v = await prisma.vendor.create({ data: { name, brandKey: brandKey(name) } });
    madeVendors.push(v.id);
    const articleId = await mkDraft();
    const submissionId = tag(); madeSubs.push(submissionId);
    await prisma.contentSubmission.create({ data: { submissionId, raw: '{}', status: 'PROCESSED', matchStatus: 'suggest', matchName: name, articleId } });

    await resolveIntakeVendor(submissionId, v.id);

    const sub = await prisma.contentSubmission.findUnique({ where: { submissionId }, select: { vendorId: true, matchStatus: true } });
    expect(sub?.vendorId).toBe(v.id);
    expect(sub?.matchStatus).toBe('confirmed');
    const art = await prisma.article.findUnique({ where: { id: articleId }, select: { sponsorVendorId: true } });
    expect(art?.sponsorVendorId).toBe(v.id);
  });

  it('creates a flagged vendor from the submitted name when told "new"', async () => {
    const name = `BrandNew ${tag()}`;
    const articleId = await mkDraft();
    const submissionId = tag(); madeSubs.push(submissionId);
    await prisma.contentSubmission.create({ data: { submissionId, raw: '{}', status: 'PROCESSED', matchStatus: 'suggest', matchName: name, articleId } });

    await resolveIntakeVendor(submissionId, 'new');

    const sub = await prisma.contentSubmission.findUnique({ where: { submissionId }, select: { vendorId: true } });
    const v = await prisma.vendor.findUnique({ where: { id: sub!.vendorId! }, select: { autoCreated: true, name: true } });
    madeVendors.push(sub!.vendorId!);
    expect(v?.autoCreated).toBe(true);
    expect(v?.name).toBe(name);
  });
});

describe('notifySponsorLive', () => {
  it('records copy-paste go-live text for a non-premium vendor and fires once', async () => {
    const name = `NonPremium ${tag()}`;
    const v = await prisma.vendor.create({ data: { name, brandKey: brandKey(name), premium: false } });
    madeVendors.push(v.id);
    const articleId = await mkDraft({ status: 'PUBLISHED', sponsorVendorId: v.id });

    await notifySponsorLive(articleId);
    let logs = await prisma.adminLog.findMany({ where: { kind: 'sponsor_golive' } });
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain(name);
    const art = await prisma.article.findUnique({ where: { id: articleId }, select: { sponsorNotifiedAt: true } });
    expect(art?.sponsorNotifiedAt).toBeTruthy();

    // Guard: a second call must NOT create another note.
    await notifySponsorLive(articleId);
    logs = await prisma.adminLog.findMany({ where: { kind: 'sponsor_golive' } });
    expect(logs.length).toBe(1);
  });

  it('does nothing for an unpublished or non-sponsored article', async () => {
    const draft = await mkDraft({ status: 'DRAFT', sponsorVendorId: null });
    await notifySponsorLive(draft);
    const logs = await prisma.adminLog.findMany({ where: { kind: 'sponsor_golive' } });
    expect(logs.length).toBe(0);
  });
});
