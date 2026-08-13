// Integration tests for the sponsored-content intake pipeline — these hit the DB.
// They lock in the guarantees a unit test can't reach end-to-end: a near-certain
// vendor match auto-links; a typo match is HELD unbound (confirm-before-merge); an
// unknown company creates a flagged vendor; and the built article is ALWAYS a
// sponsored DRAFT (never auto-published) with an admin ping. Rows are namespaced
// per run and cleaned up, so this is safe against a shared DB.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import { brandKey } from './entitlements';
import { ingestContentSubmission } from './contentIngest';

let seq = 0;
const tag = () => `cit${Date.now().toString(36)}${seq++}`;

const madeArticles: string[] = [];
const madeVendors: string[] = [];
const madeSubs: string[] = [];

function sub(company: string, over: Record<string, unknown> = {}) {
  return { company, email: 'x@example.com', headline: `Headline ${tag()}`, body: 'Body copy.', creative: [], ...over };
}
async function run(company: string, subId: string, over?: Record<string, unknown>) {
  const r = await ingestContentSubmission(sub(company, over), subId);
  madeArticles.push(r.articleId);
  if (r.vendorId) madeVendors.push(r.vendorId);
  if (r.matchVendorId) madeVendors.push(r.matchVendorId);
  return r;
}

afterEach(async () => {
  if (madeArticles.length) await prisma.article.deleteMany({ where: { id: { in: madeArticles } } });
  if (madeSubs.length) await prisma.contentSubmission.deleteMany({ where: { submissionId: { in: madeSubs } } });
  if (madeVendors.length) await prisma.vendor.deleteMany({ where: { id: { in: [...new Set(madeVendors)] } } });
  await prisma.adminLog.deleteMany({ where: { kind: 'content_submission' } });
  madeArticles.length = 0; madeVendors.length = 0; madeSubs.length = 0;
});

describe('ingestContentSubmission', () => {
  it('always builds a sponsored DRAFT — never auto-publishes', async () => {
    const r = await run(`DraftCo ${tag()}`, tag());
    const a = await prisma.article.findUnique({ where: { id: r.articleId }, select: { status: true, genre: true, sponsoredUntil: true, previewToken: true } });
    expect(a?.status).toBe('DRAFT');
    expect(a?.genre).toBe('sponsored');
    expect(a?.sponsoredUntil).toBeTruthy();
    expect(a?.previewToken).toBeTruthy();
  });

  it('pings the admins (AdminLog) that a draft is ready', async () => {
    const company = `PingCo ${tag()}`;
    await run(company, tag());
    const logRow = await prisma.adminLog.findFirst({ where: { kind: 'content_submission' }, orderBy: { createdAt: 'desc' } });
    expect(logRow?.message).toContain(company);
  });

  it('auto-links a near-certain vendor match', async () => {
    const name = `AutoBrand ${tag()}`;
    const v = await prisma.vendor.create({ data: { name, brandKey: brandKey(name) } });
    madeVendors.push(v.id);
    const r = await run(`${name} LLC`, tag()); // suffix only → near-certain
    expect(r.matchStatus).toBe('auto');
    expect(r.vendorId).toBe(v.id);
    const a = await prisma.article.findUnique({ where: { id: r.articleId }, select: { sponsorVendorId: true } });
    expect(a?.sponsorVendorId).toBe(v.id);
  });

  it('HOLDS a typo match unbound for admin confirmation (confirm-before-merge)', async () => {
    // Distinctive (unshared) names so the score isn't inflated by a common token;
    // two small typos land it in the SUGGEST band (~70–91), not near-certain.
    const name = 'Brontewick Fulfillment';
    const v = await prisma.vendor.upsert({ where: { brandKey: brandKey(name) }, update: {}, create: { name, brandKey: brandKey(name) } });
    madeVendors.push(v.id);
    const r = await run('Brontwick Fulfilment', tag()); // two-letter typos
    expect(r.matchStatus).toBe('suggest');
    expect(r.vendorId).toBeNull();          // NOT merged on a guess
    expect(r.matchVendorId).toBe(v.id);     // candidate recorded for confirmation
    const a = await prisma.article.findUnique({ where: { id: r.articleId }, select: { sponsorVendorId: true } });
    expect(a?.sponsorVendorId).toBeNull();
  });

  it('creates a flagged vendor when nothing matches', async () => {
    const name = `Totally Unique Newcomer ${tag()}`;
    const r = await run(name, tag());
    expect(r.matchStatus).toBe('new');
    expect(r.vendorId).toBeTruthy();
    const v = await prisma.vendor.findUnique({ where: { id: r.vendorId! }, select: { autoCreated: true } });
    expect(v?.autoCreated).toBe(true);
  });

  it('pins the submitter as the article contact (the per-article paper trail)', async () => {
    const company = `ContactCo ${tag()}`;
    const r = await run(company, tag(), { contactName: 'Jordan Lee', email: 'jordan@contactco.test' });
    // The contact is archived ON THE ARTICLE — who to reach about this piece.
    const a = await prisma.article.findUnique({ where: { id: r.articleId }, select: { sponsorContactName: true, sponsorContactEmail: true } });
    expect(a?.sponsorContactName).toBe('Jordan Lee');
    expect(a?.sponsorContactEmail).toBe('jordan@contactco.test');
    // The new vendor's public phone-book contact is left blank for an admin to
    // curate — the submitter is NOT copied onto the vendor directory row.
    const v = await prisma.vendor.findUnique({ where: { id: r.vendorId! }, select: { contactName: true, contactEmail: true } });
    expect(v?.contactName).toBeNull();
    expect(v?.contactEmail).toBeNull();
  });

  it('NEVER touches an existing vendor’s admin-curated, publicly-shown contact', async () => {
    // A premium supplier with a curated phone-book contact (the sales rep).
    const name = `Curated Supplier ${tag()}`;
    const v = await prisma.vendor.create({
      data: { name, brandKey: brandKey(name), premium: true, contactName: 'Dave Miller', contactEmail: 'dave@curated.test' },
    });
    madeVendors.push(v.id);
    // An auto-matching submission arrives naming a DIFFERENT submitter.
    const r = await run(`${name} LLC`, tag(), { contactName: 'Someone Else', email: 'someone@else.test' });
    expect(r.matchStatus).toBe('auto');
    expect(r.vendorId).toBe(v.id);
    // Public directory fields are UNCHANGED — no defacement.
    const after = await prisma.vendor.findUnique({ where: { id: v.id }, select: { contactName: true, contactEmail: true } });
    expect(after?.contactName).toBe('Dave Miller');
    expect(after?.contactEmail).toBe('dave@curated.test');
    // The submitter is captured only on the article itself.
    const a = await prisma.article.findUnique({ where: { id: r.articleId }, select: { sponsorContactName: true, sponsorContactEmail: true } });
    expect(a?.sponsorContactName).toBe('Someone Else');
    expect(a?.sponsorContactEmail).toBe('someone@else.test');
  });
});
