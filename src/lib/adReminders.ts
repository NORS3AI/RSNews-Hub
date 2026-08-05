// Vendor reminder emails for the ad-sales lifecycle. Two nudges:
//   • "fresh ads needed" — a flight starts soon but has no scheduled creatives;
//   • "renewal" — a campaign is nearing its end, submit again to keep running.
//
// Templates are pure (subject/text/html) so they're unit-tested; `sendDueReminders`
// finds what's due, sends via the email seam, and marks "reminded" ONLY after a
// successful (or safely no-op'd) send, so we never mark done without notifying.
// Vendors with no `contactEmail` are skipped (and left due) until one is known.

import { prisma } from './db';
import { sendEmail, renderEmail, escapeHtml } from './email';
import { daysLeft } from './adPlans';

export const FRESH_ADS_LEAD_DAYS = 21;
export const RENEWAL_LEAD_DAYS = 30;

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export type BuiltEmail = { subject: string; text: string; html: string };

/** "Your next flight needs fresh ads" nudge. */
export function freshAdsEmail(p: { vendorName: string; flightIndex: number; startAt: Date; now: Date }): BuiltEmail {
  const when = fmtDate(p.startAt);
  const days = daysLeft(p.startAt, p.now);
  const subject = `Fresh ads needed for your RS News flight (starts ${when})`;
  const text =
    `Hi ${p.vendorName},\n\n` +
    `Flight ${p.flightIndex} of your RS News ad campaign starts on ${when} (about ${days} day${days === 1 ? '' : 's'} away) and still needs its creatives.\n` +
    `Please submit your fresh ads so we can review and schedule them before it begins.\n\n` +
    `— RS News`;
  const html = renderEmail('Fresh ads needed', `
    <p style="margin:0 0 12px">Hi ${escapeHtml(p.vendorName)},</p>
    <p style="margin:0 0 12px">Flight <strong>${p.flightIndex}</strong> of your RS News ad campaign starts on <strong>${escapeHtml(when)}</strong> (about ${days} day${days === 1 ? '' : 's'} away) and still needs its creatives.</p>
    <p style="margin:0 0 12px">Please submit your fresh ads so we can review and schedule them before it begins.</p>
    <p style="margin:16px 0 0;color:#8a8f98">— RS News</p>`);
  return { subject, text, html };
}

/** "Your campaign is ending soon — renew" nudge. */
export function renewalEmail(p: { vendorName: string; endAt: Date; now: Date }): BuiltEmail {
  const when = fmtDate(p.endAt);
  const days = daysLeft(p.endAt, p.now);
  const subject = `Your RS News campaign ends ${when} — renew to keep running`;
  const text =
    `Hi ${p.vendorName},\n\n` +
    `Your RS News ad campaign ends on ${when} (about ${days} day${days === 1 ? '' : 's'} away).\n` +
    `To keep your ads running without a gap, submit a new package before then.\n\n` +
    `— RS News`;
  const html = renderEmail('Time to renew', `
    <p style="margin:0 0 12px">Hi ${escapeHtml(p.vendorName)},</p>
    <p style="margin:0 0 12px">Your RS News ad campaign ends on <strong>${escapeHtml(when)}</strong> (about ${days} day${days === 1 ? '' : 's'} away).</p>
    <p style="margin:0 0 12px">To keep your ads running without a gap, submit a new package before then.</p>
    <p style="margin:16px 0 0;color:#8a8f98">— RS News</p>`);
  return { subject, text, html };
}

export type ReminderSummary = { freshAdsReminders: number; renewalReminders: number; skippedNoEmail: number };

/** Find due reminders, email the vendor, and mark reminded on success. Idempotent. */
export async function sendDueReminders(now: Date): Promise<ReminderSummary> {
  let freshAdsReminders = 0, renewalReminders = 0, skippedNoEmail = 0;

  // Fresh-ads: a flight needing creatives that starts within the lead window and
  // hasn't been reminded, on an active campaign.
  const freshLead = new Date(now.getTime() + FRESH_ADS_LEAD_DAYS * 86_400_000);
  const flights = await prisma.adFlight.findMany({
    where: { status: { in: ['AWAITING', 'REVIEW'] }, startAt: { gt: now, lte: freshLead }, remindedAt: null, campaign: { status: 'ACTIVE' } },
    select: { id: true, index: true, startAt: true, campaign: { select: { vendorName: true, vendor: { select: { contactEmail: true } } } } },
  });
  for (const f of flights) {
    const to = f.campaign.vendor?.contactEmail;
    if (!to) { skippedNoEmail++; continue; }
    const { subject, text, html } = freshAdsEmail({ vendorName: f.campaign.vendorName, flightIndex: f.index, startAt: f.startAt, now });
    const r = await sendEmail({ to, subject, text, html });
    if (r.ok) { await prisma.adFlight.update({ where: { id: f.id }, data: { remindedAt: now } }); freshAdsReminders++; }
  }

  // Renewal: an active campaign nearing its end that we haven't nudged yet.
  const renewLead = new Date(now.getTime() + RENEWAL_LEAD_DAYS * 86_400_000);
  const campaigns = await prisma.adCampaign.findMany({
    where: { status: 'ACTIVE', endAt: { gt: now, lte: renewLead }, renewalRemindedAt: null },
    select: { id: true, vendorName: true, endAt: true, vendor: { select: { contactEmail: true } } },
  });
  for (const c of campaigns) {
    const to = c.vendor?.contactEmail;
    if (!to) { skippedNoEmail++; continue; }
    const { subject, text, html } = renewalEmail({ vendorName: c.vendorName, endAt: c.endAt, now });
    const r = await sendEmail({ to, subject, text, html });
    if (r.ok) { await prisma.adCampaign.update({ where: { id: c.id }, data: { renewalRemindedAt: now } }); renewalReminders++; }
  }

  return { freshAdsReminders, renewalReminders, skippedNoEmail };
}
