// Ad campaign lifecycle (server-side). A campaign is a vendor's purchase; it's
// split into 3-month flights. Admin assigns creatives to a flight and schedules
// it ("Go"); serving (lib/ads) shows a flight's ads only inside its window, so
// takedown at the flight end is automatic. `advanceLifecycle` is the nightly
// tidy-up: it ends elapsed flights, completes finished campaigns, and flags the
// flights whose fresh creatives are due soon (reminder to the vendor).

import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { planByKey, planEnd, generateFlights } from './adPlans';
import { sendEmail } from './email';
import { renderTemplate } from './emailTemplates';
import { findOrCreateVendor } from './vendors';
import { campaignIsPaid, paymentRequired } from './payments';

type Db = Prisma.TransactionClient | typeof prisma;

export type CreateCampaignInput = {
  vendorName: string;
  vendorId?: string;     // pre-resolved vendor; else derived from vendorName
  plan: string;
  startAt: Date;
  endAt?: Date | null;   // required for seasonal plans; else derived from the plan length
  notes?: string;
  status?: string;       // 'ACTIVE' (admin-created) | 'DRAFT' (e.g. JotForm — needs review)
};

/** Create a campaign and its flights. Returns the campaign id. Pass `db` to run
 *  inside a transaction (e.g. JotForm ingest). */
export async function createCampaign(input: CreateCampaignInput, db: Db = prisma): Promise<string> {
  const plan = planByKey(input.plan);
  if (!plan) throw new Error('Unknown ad plan');
  const endAt = input.endAt ?? planEnd(plan, input.startAt);
  if (!endAt) throw new Error('A seasonal plan needs an explicit end date');
  if (endAt <= input.startAt) throw new Error('End date must be after the start date');

  // Attach to the Vendor entity (created on first use) so the campaign links by
  // id, not by the free-text label.
  const vendorId = input.vendorId ?? (await findOrCreateVendor(input.vendorName, db));

  const flights = generateFlights(input.startAt, endAt, plan.flightDays);
  const campaign = await db.adCampaign.create({
    data: {
      vendorName: input.vendorName,
      vendorId,
      plan: input.plan,
      startAt: input.startAt,
      endAt,
      allowsVideo: plan.allowsVideo,
      notes: input.notes || null,
      status: input.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
      flights: { create: flights.map((f) => ({ index: f.index, startAt: f.startAt, endAt: f.endAt })) },
    },
  });
  return campaign.id;
}

/** Assign a set of existing ad creatives to a flight (moves them into paid inventory). */
export async function assignAdsToFlight(flightId: string, adIds: string[]): Promise<void> {
  if (!adIds.length) return;
  await prisma.ad.updateMany({ where: { id: { in: adIds } }, data: { flightId } });
  await prisma.adFlight.update({ where: { id: flightId }, data: { status: 'REVIEW' } });
}

/** Remove an ad from its flight (back to unassigned). */
export async function unassignAd(adId: string): Promise<void> {
  await prisma.ad.update({ where: { id: adId }, data: { flightId: null } });
}

/**
 * The vendor's paid run must start when the admin puts the campaign LIVE, not
 * when the JotForm arrived — otherwise review time silently eats into their run.
 * Returns the milliseconds to slide the whole schedule so it begins at `now`, but
 * only on the first go-live of a campaign that hasn't started yet and whose start
 * is at/behind now. An already-running campaign, or a vendor-requested FUTURE
 * start, is left alone (→ 0). Pure so it's unit-tested without a DB.
 */
export function firstRunAnchorDelta(startAt: Date, now: Date, everLive: boolean): number {
  if (everLive) return 0;                                  // already running — don't move it
  const delta = now.getTime() - startAt.getTime();
  return delta > 0 ? delta : 0;                            // future/now start → honor it
}

/** On the first go-live, re-anchor the campaign + its flights to `now` so the
 *  vendor gets their full purchased length from the admin's push, and flip a
 *  DRAFT (e.g. from JotForm) to ACTIVE so the lifecycle + renewal reminders
 *  start tracking it. Idempotent: does nothing once the campaign is running. */
async function anchorToGoLive(campaignId: string, now: Date): Promise<void> {
  const c = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true, startAt: true, endAt: true, flights: { select: { id: true, status: true, startAt: true, endAt: true } } },
  });
  if (!c) return;
  const everLive = c.flights.some((f) => f.status === 'SCHEDULED' || f.status === 'ENDED');
  const delta = firstRunAnchorDelta(c.startAt, now, everLive);
  const goingActive = !everLive && c.status === 'DRAFT';
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (delta > 0) {
    ops.push(prisma.adCampaign.update({ where: { id: campaignId }, data: { startAt: now, endAt: new Date(c.endAt.getTime() + delta), ...(goingActive ? { status: 'ACTIVE' } : {}) } }));
    for (const f of c.flights) ops.push(prisma.adFlight.update({ where: { id: f.id }, data: { startAt: new Date(f.startAt.getTime() + delta), endAt: new Date(f.endAt.getTime() + delta) } }));
  } else if (goingActive) {
    ops.push(prisma.adCampaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } }));
  }
  if (ops.length) await prisma.$transaction(ops);
}

/** Schedule a flight ("Go"): it must have at least one creative. A confirmed
 *  payment is only required when ADS_REQUIRE_PAYMENT is on — by default no money
 *  crosses the hub, so approval isn't gated on payment.
 *  The first go-live re-anchors the paid window to now (see anchorToGoLive). */
export async function scheduleFlight(flightId: string): Promise<void> {
  const flight = await prisma.adFlight.findUnique({ where: { id: flightId }, select: { campaignId: true, _count: { select: { ads: true } } } });
  if (!flight) throw new Error('Flight not found');
  if (flight._count.ads === 0) throw new Error('Add at least one creative before scheduling this flight');
  if (paymentRequired() && !(await campaignIsPaid(flight.campaignId))) throw new Error('Payment for this campaign isn’t confirmed yet — confirm it before this flight can go live.');
  await anchorToGoLive(flight.campaignId, new Date());
  await prisma.adFlight.update({ where: { id: flightId }, data: { status: 'SCHEDULED' } });
  await notifyAdsLive(flight.campaignId);
}

/** The first time a campaign has a live flight, email the vendor that their ads
 *  are live with a link to their dashboard preview. Sent once (guarded by
 *  liveNotifiedAt), only after a successful send, and only if we have an email. */
async function notifyAdsLive(campaignId: string): Promise<void> {
  const c = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { vendorName: true, liveNotifiedAt: true, vendor: { select: { contactEmail: true, contactName: true, orderContactEmail: true, orderContactName: true } } },
  });
  if (!c || c.liveNotifiedAt) return;
  // Email the person who placed the latest order first; fall back to the curated
  // phone-book address.
  const to = c.vendor?.orderContactEmail || c.vendor?.contactEmail;
  if (!to) return; // no address yet — leave unnotified so a later go-live can still send
  const dashboardUrl = `${process.env.SITE_URL || ''}/docs/vendor`;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  // Greet the vendor's latest order contact person, falling back to the curated
  // contact, then the company name.
  const contactName = c.vendor?.orderContactName || c.vendor?.contactName || c.vendorName;
  const { subject, text, html } = await renderTemplate('ads_live', { contactName, vendorName: c.vendorName, date, dashboardUrl });
  const r = await sendEmail({ to, subject, text, html });
  if (r.ok) await prisma.adCampaign.update({ where: { id: campaignId }, data: { liveNotifiedAt: new Date() } });
}

/** Pull a scheduled flight back to review (stops it serving immediately). */
export async function pauseFlight(flightId: string): Promise<void> {
  await prisma.adFlight.update({ where: { id: flightId }, data: { status: 'REVIEW' } });
}

/** Cancel a campaign: end all its flights so nothing keeps serving. */
export async function cancelCampaign(id: string): Promise<void> {
  await prisma.adFlight.updateMany({ where: { campaignId: id }, data: { status: 'ENDED' } });
  await prisma.adCampaign.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export type LifecycleSummary = { endedFlights: number; completedCampaigns: number };

/**
 * Nightly lifecycle transitions: end elapsed scheduled flights and complete
 * campaigns past their end. Idempotent. Vendor reminder EMAILS are a separate
 * step (src/lib/adReminders) that marks "reminded" only after a successful send,
 * so nothing is silently marked done without actually notifying the vendor.
 */
export async function advanceLifecycle(now: Date): Promise<LifecycleSummary> {
  const ended = await prisma.adFlight.updateMany({ where: { status: 'SCHEDULED', endAt: { lte: now } }, data: { status: 'ENDED' } });
  const completed = await prisma.adCampaign.updateMany({ where: { status: 'ACTIVE', endAt: { lte: now } }, data: { status: 'COMPLETED' } });
  return {
    endedFlights: ended.count,
    completedCampaigns: completed.count,
  };
}
