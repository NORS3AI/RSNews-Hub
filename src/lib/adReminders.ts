// Vendor reminder emails for the ad-sales lifecycle. Two nudges:
//   • "fresh ads needed" — a flight starts soon but has no scheduled creatives;
//   • "renewal" — a campaign is nearing its end, submit again to keep running.
//
// The COPY is admin-editable (see src/lib/emailTemplates + /admin/email-templates);
// here we just find what's due, build the merge-tag values, render the chosen
// template, and send. A reminder is marked sent ONLY after a successful (or safely
// no-op'd) send, so we never mark done without notifying. Vendors with no
// `contactEmail` are skipped (and left due) until one is known.

import { prisma } from './db';
import { sendEmail } from './email';
import { renderTemplate, type TemplateVars } from './emailTemplates';
import { daysLeft, planByKey } from './adPlans';

export const FRESH_ADS_LEAD_DAYS = 21;
export const RENEWAL_LEAD_DAYS = 30;

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`;
const orderUrl = () => process.env.AD_ORDER_URL || '';
const packageLabel = (plan: string) => planByKey(plan)?.label ?? plan;

export type ReminderSummary = { freshAdsReminders: number; renewalReminders: number; skippedNoEmail: number };

/** Find due reminders, email the vendor, and mark reminded on success. Idempotent. */
export async function sendDueReminders(now: Date): Promise<ReminderSummary> {
  let freshAdsReminders = 0, renewalReminders = 0, skippedNoEmail = 0;

  // Fresh-ads: a flight needing creatives that starts within the lead window and
  // hasn't been reminded, on an active campaign.
  const freshLead = new Date(now.getTime() + FRESH_ADS_LEAD_DAYS * 86_400_000);
  const flights = await prisma.adFlight.findMany({
    where: { status: { in: ['AWAITING', 'REVIEW'] }, startAt: { gt: now, lte: freshLead }, remindedAt: null, campaign: { status: 'ACTIVE' } },
    select: { id: true, index: true, startAt: true, campaign: { select: { vendorName: true, plan: true, vendor: { select: { contactEmail: true } } } } },
  });
  for (const f of flights) {
    const to = f.campaign.vendor?.contactEmail;
    if (!to) { skippedNoEmail++; continue; }
    const vars: TemplateVars = {
      vendorName: f.campaign.vendorName,
      batchOrdinal: ordinal(f.index), batchNumber: String(f.index),
      packageLabel: packageLabel(f.campaign.plan),
      date: fmtDate(f.startAt), daysUntil: String(daysLeft(f.startAt, now)),
      submitUrl: orderUrl(),
    };
    const { subject, text, html } = await renderTemplate('fresh_ads', vars);
    const r = await sendEmail({ to, subject, text, html });
    if (r.ok) { await prisma.adFlight.update({ where: { id: f.id }, data: { remindedAt: now } }); freshAdsReminders++; }
  }

  // Renewal: an active campaign nearing its end that we haven't nudged yet.
  const renewLead = new Date(now.getTime() + RENEWAL_LEAD_DAYS * 86_400_000);
  const campaigns = await prisma.adCampaign.findMany({
    where: { status: 'ACTIVE', endAt: { gt: now, lte: renewLead }, renewalRemindedAt: null },
    select: { id: true, vendorName: true, plan: true, endAt: true, vendor: { select: { contactEmail: true } } },
  });
  for (const c of campaigns) {
    const to = c.vendor?.contactEmail;
    if (!to) { skippedNoEmail++; continue; }
    const vars: TemplateVars = {
      vendorName: c.vendorName, packageLabel: packageLabel(c.plan),
      date: fmtDate(c.endAt), daysUntil: String(daysLeft(c.endAt, now)),
      submitUrl: orderUrl(),
    };
    const { subject, text, html } = await renderTemplate('renewal', vars);
    const r = await sendEmail({ to, subject, text, html });
    if (r.ok) { await prisma.adCampaign.update({ where: { id: c.id }, data: { renewalRemindedAt: now } }); renewalReminders++; }
  }

  return { freshAdsReminders, renewalReminders, skippedNoEmail };
}
