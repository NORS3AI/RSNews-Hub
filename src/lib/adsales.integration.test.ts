// Integration tests for the ad-sales server logic — these hit the DB (the
// dev/CI SQLite created by `prisma db push`), so they lock in the security- and
// money-adjacent behaviour that pure unit tests can't reach: the payment-
// confirmation go-live gate, vendor-email freshness, report scoping, reminder
// send/skip, and payment dedup. Each test namespaces its rows by a unique brand
// and cleans up, so they're safe to run against a shared DB.

import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from './db';
import { findOrCreateVendor } from './vendors';
import { createCampaign, assignAdsToFlight, scheduleFlight } from './campaigns';
import { markCampaignPaid, campaignIsPaid, recordPayment } from './payments';
import { generateReportDraft, publishReport, listPublishedReports, lastCompletedQuarter } from './reports';
import { sendDueReminders } from './adReminders';

let seq = 0;
const brand = (base: string) => `${base}-it${Date.now().toString(36)}-${seq++}`;

async function purge(vendorName: string) {
  const v = await prisma.vendor.findUnique({ where: { brandKey: vendorName.trim().toLowerCase() }, select: { id: true } });
  if (v) {
    await prisma.payment.deleteMany({ where: { vendorId: v.id } });
    await prisma.adCampaign.deleteMany({ where: { vendorId: v.id } }); // cascades flights
    await prisma.vendor.delete({ where: { id: v.id } });               // cascades reports
  }
  await prisma.adCampaign.deleteMany({ where: { vendorName } });
}

const day = 86_400_000;

describe('payment-confirmation go-live gate', () => {
  it('blocks scheduling until confirmed, then allows it', async () => {
    const name = brand('GateCo');
    const vendorId = await findOrCreateVendor(name);
    const campaignId = await createCampaign({ vendorName: name, vendorId, plan: 'quarter', startAt: new Date(), status: 'DRAFT' });
    const flight = await prisma.adFlight.findFirst({ where: { campaignId }, orderBy: { index: 'asc' } });
    const ad = await prisma.ad.create({ data: { brand: name, headline: 'x', active: false } });
    await assignAdsToFlight(flight!.id, [ad.id]);

    expect(await campaignIsPaid(campaignId)).toBe(false);
    await expect(scheduleFlight(flight!.id)).rejects.toThrow(/confirm/i);
    expect((await prisma.adFlight.findUnique({ where: { id: flight!.id } }))!.status).not.toBe('SCHEDULED');

    await markCampaignPaid(campaignId, 30000);
    expect(await campaignIsPaid(campaignId)).toBe(true);
    await scheduleFlight(flight!.id);
    expect((await prisma.adFlight.findUnique({ where: { id: flight!.id } }))!.status).toBe('SCHEDULED');

    await purge(name);
  });

  it('refuses to schedule a flight with no creative even when confirmed', async () => {
    const name = brand('EmptyCo');
    const vendorId = await findOrCreateVendor(name);
    const campaignId = await createCampaign({ vendorName: name, vendorId, plan: 'quarter', startAt: new Date(), status: 'DRAFT' });
    await markCampaignPaid(campaignId);
    const flight = await prisma.adFlight.findFirst({ where: { campaignId } });
    await expect(scheduleFlight(flight!.id)).rejects.toThrow(/creative/i);
    await purge(name);
  });
});

describe('vendor contact email (JotForm freshness)', () => {
  it('a later order overwrites the email; a no-email call leaves it', async () => {
    const name = brand('FreshCo');
    const id = await findOrCreateVendor(name, prisma, 'first@v.com');
    expect((await prisma.vendor.findUnique({ where: { id } }))!.contactEmail).toBe('first@v.com');
    await findOrCreateVendor(name, prisma, 'second@v.com');
    expect((await prisma.vendor.findUnique({ where: { id } }))!.contactEmail).toBe('second@v.com');
    await findOrCreateVendor(name); // no email → untouched
    expect((await prisma.vendor.findUnique({ where: { id } }))!.contactEmail).toBe('second@v.com');
    await purge(name);
  });
});

describe('performance reports scoping', () => {
  it('vendors only see PUBLISHED reports; generate is idempotent per period', async () => {
    const name = brand('ReportCo');
    const vendorId = await findOrCreateVendor(name);
    const q = lastCompletedQuarter(new Date());

    const id1 = await generateReportDraft(vendorId, q);
    const id2 = await generateReportDraft(vendorId, q); // same period → same row
    expect(id2).toBe(id1);

    expect(await listPublishedReports(vendorId)).toHaveLength(0); // draft not visible
    await publishReport(id1);
    const pub = await listPublishedReports(vendorId);
    expect(pub).toHaveLength(1);
    expect(pub[0].status).toBe('PUBLISHED');

    await purge(name);
  });
});

describe('reminder emails', () => {
  it('sends (marks) for a vendor with an email; skips one without', async () => {
    const now = new Date();
    const withName = brand('HasEmail');
    const noName = brand('NoEmail');

    for (const [name, email] of [[withName, 'ads@hasemail.com'], [noName, null]] as const) {
      const vendorId = await findOrCreateVendor(name, prisma, email ?? undefined);
      // Active campaign ending in ~20d (renewal due <30d). Replace the auto-split
      // flights with an explicit pair: flight 1 live, flight 2 AWAITING starting
      // ~10d out (fresh-ads due <21d) — the two nudges the test exercises.
      const campaign = await createCampaign({ vendorName: name, vendorId, plan: 'half', startAt: new Date(now.getTime() - 70 * day), endAt: new Date(now.getTime() + 20 * day), status: 'ACTIVE' });
      await prisma.adFlight.deleteMany({ where: { campaignId: campaign } });
      await prisma.adFlight.createMany({ data: [
        { campaignId: campaign, index: 1, status: 'SCHEDULED', startAt: new Date(now.getTime() - 70 * day), endAt: new Date(now.getTime() + 10 * day) },
        { campaignId: campaign, index: 2, status: 'AWAITING', startAt: new Date(now.getTime() + 10 * day), endAt: new Date(now.getTime() + 100 * day) },
      ] });
    }

    const summary = await sendDueReminders(now);
    expect(summary.freshAdsReminders).toBeGreaterThanOrEqual(1);
    expect(summary.renewalReminders).toBeGreaterThanOrEqual(1);
    expect(summary.skippedNoEmail).toBeGreaterThanOrEqual(2);

    const withV = await prisma.vendor.findUnique({ where: { brandKey: withName.toLowerCase() }, select: { id: true } });
    const withCampaign = await prisma.adCampaign.findFirst({ where: { vendorId: withV!.id }, select: { renewalRemindedAt: true, flights: { where: { index: 2 }, select: { remindedAt: true } } } });
    expect(withCampaign!.renewalRemindedAt).not.toBeNull();
    expect(withCampaign!.flights[0].remindedAt).not.toBeNull();

    const noV = await prisma.vendor.findUnique({ where: { brandKey: noName.toLowerCase() }, select: { id: true } });
    const noCampaign = await prisma.adCampaign.findFirst({ where: { vendorId: noV!.id }, select: { renewalRemindedAt: true, flights: { where: { index: 2 }, select: { remindedAt: true } } } });
    expect(noCampaign!.renewalRemindedAt).toBeNull();
    expect(noCampaign!.flights[0].remindedAt).toBeNull();

    // Idempotent: the with-email vendor is already marked, so no new fresh/renewal for it.
    const again = await sendDueReminders(now);
    expect(again.freshAdsReminders).toBe(0);
    expect(again.renewalReminders).toBe(0);

    await purge(withName);
    await purge(noName);
  });
});

describe('payment dedup', () => {
  it('recordPayment never double-records the same transaction id', async () => {
    const name = brand('DedupCo');
    const vendorId = await findOrCreateVendor(name);
    const campaignId = await createCampaign({ vendorName: name, vendorId, plan: 'quarter', startAt: new Date(), status: 'DRAFT' });
    const ext = `txn_${Date.now()}`;
    await recordPayment({ campaignId, vendorId, provider: 'jotform', externalId: ext, amountCents: 30000, status: 'PAID' });
    await recordPayment({ campaignId, vendorId, provider: 'jotform', externalId: ext, amountCents: 30000, status: 'PAID' });
    expect(await prisma.payment.count({ where: { campaignId } })).toBe(1);
    await purge(name);
  });
});
