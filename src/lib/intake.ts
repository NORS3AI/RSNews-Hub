// Sponsored-intake admin operations (server-side, DB): confirming the vendor a
// held submission belongs to (confirm-before-merge), and the second stage of the
// two-stage notify — telling the vendor their sponsored article is LIVE.
//
// Stage one (a draft is waiting) fires in lib/contentIngest. Stage two fires from
// the article save when a sponsored, vendor-linked article first publishes:
//   • a PREMIUM vendor (they have a live dashboard + a contact on file) gets a
//     direct go-live email — the "push";
//   • otherwise we record ready-to-send copy the admin pastes to the vendor.
// Either way it's sent at most once (guarded by sponsorNotifiedAt).

import { prisma } from './db';
import { log } from './logger';
import { brandKey } from './entitlements';
import { sendEmail } from './email';

/**
 * Confirm which vendor a held submission belongs to, then bind it: link the draft
 * article to the vendor and mark the submission confirmed. `vendorId === 'new'`
 * creates a fresh (flagged) vendor from the submitted name. Idempotent-ish: safe
 * to re-run; always leaves the submission pointing at the chosen vendor.
 */
export async function resolveIntakeVendor(submissionId: string, vendorId: string): Promise<void> {
  const sub = await prisma.contentSubmission.findUnique({
    where: { submissionId },
    select: { id: true, articleId: true, matchName: true },
  });
  if (!sub) throw new Error('Submission not found');

  let resolvedId = vendorId;
  if (vendorId === 'new') {
    const name = (sub.matchName || '').trim();
    if (!name) throw new Error('No company name on the submission to create a vendor from');
    const v = await prisma.vendor.upsert({
      where: { brandKey: brandKey(name) },
      update: {},
      create: { name, brandKey: brandKey(name), autoCreated: true },
      select: { id: true },
    });
    resolvedId = v.id;
  } else {
    const exists = await prisma.vendor.findUnique({ where: { id: resolvedId }, select: { id: true } });
    if (!exists) throw new Error('Chosen vendor not found');
  }

  await prisma.contentSubmission.update({
    where: { submissionId },
    data: { vendorId: resolvedId, matchVendorId: resolvedId, matchStatus: 'confirmed' },
  });
  if (sub.articleId) {
    await prisma.article.update({ where: { id: sub.articleId }, data: { sponsorVendorId: resolvedId } });
  }
}

/**
 * Stage-two notify: when a sponsored, vendor-linked article first goes live, tell
 * the vendor. Premium vendors with a contact get an email push; everyone else
 * gets ready-to-send copy recorded to the activity log for the admin to send.
 * Guarded to fire once (sponsorNotifiedAt). Never throws — a save must not fail
 * because a notification couldn't be delivered.
 */
export async function notifySponsorLive(articleId: string): Promise<void> {
  try {
    const a = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, slug: true, status: true, sponsorVendorId: true, sponsorNotifiedAt: true },
    });
    if (!a || a.status !== 'PUBLISHED' || !a.sponsorVendorId || a.sponsorNotifiedAt) return;

    const vendor = await prisma.vendor.findUnique({
      where: { id: a.sponsorVendorId },
      select: { name: true, premium: true, contactEmail: true },
    });
    if (!vendor) return;

    const url = `${process.env.SITE_URL || ''}/docs/article/${a.slug}`;
    const subject = `Your sponsored article is live on RS News`;
    const text = `Hi ${vendor.name},\n\nYour sponsored article “${a.title}” is now live on RS News:\n${url}\n\nIt will be featured on the homepage for the next few weeks. Thanks for partnering with us!\n\n— RS News`;
    const html = text.split('\n').map((l) => l ? `<p>${l}</p>` : '<br/>').join('');

    if (vendor.premium && vendor.contactEmail) {
      const r = await sendEmail({ to: vendor.contactEmail, subject, text, html });
      if (r.ok) {
        await prisma.article.update({ where: { id: a.id }, data: { sponsorNotifiedAt: new Date() } });
        log.info('sponsor go-live email sent', { articleId: a.id });
      }
      return;
    }

    // Non-premium (or no contact on file): leave the admin ready-to-send copy.
    await prisma.adminLog.create({
      data: {
        kind: 'sponsor_golive',
        message: `Sponsored article “${a.title}” is live — send ${vendor.name} the go-live note:\n\n${text}`,
      },
    });
    await prisma.article.update({ where: { id: a.id }, data: { sponsorNotifiedAt: new Date() } });
  } catch (e) {
    log.warn('sponsor go-live notify failed', { articleId, err: (e as Error).message });
  }
}
