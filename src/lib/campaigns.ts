// Ad campaign lifecycle (server-side). A campaign is a vendor's purchase; it's
// split into 3-month flights. Admin assigns creatives to a flight and schedules
// it ("Go"); serving (lib/ads) shows a flight's ads only inside its window, so
// takedown at the flight end is automatic. `advanceLifecycle` is the nightly
// tidy-up: it ends elapsed flights, completes finished campaigns, and flags the
// flights whose fresh creatives are due soon (reminder to the vendor).

import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { planByKey, planEnd, generateFlights } from './adPlans';
import { findOrCreateVendor } from './vendors';
import { campaignIsPaid } from './payments';

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

  const flights = generateFlights(input.startAt, endAt, plan.flightMonths);
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

/** Schedule a flight ("Go"): it must have at least one creative AND the campaign's
 *  payment must be confirmed (a campaign can't go live before then — confirm it
 *  in the admin; JotForm confirms it automatically when the vendor pays there). */
export async function scheduleFlight(flightId: string): Promise<void> {
  const flight = await prisma.adFlight.findUnique({ where: { id: flightId }, select: { campaignId: true, _count: { select: { ads: true } } } });
  if (!flight) throw new Error('Flight not found');
  if (flight._count.ads === 0) throw new Error('Add at least one creative before scheduling this flight');
  if (!(await campaignIsPaid(flight.campaignId))) throw new Error('Payment for this campaign isn’t confirmed yet — confirm it before this flight can go live.');
  await prisma.adFlight.update({ where: { id: flightId }, data: { status: 'SCHEDULED' } });
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
