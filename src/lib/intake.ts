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
import { sendEmail, redact } from './email';
import { renderTemplate } from './emailTemplates';

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
    // Bind the article to the confirmed vendor. The submitter's contact stays
    // pinned on the article (sponsorContactName/Email) — the per-article paper
    // trail — so nothing is copied onto the vendor's public directory row.
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
      select: { id: true, title: true, slug: true, status: true, genre: true, sponsorVendorId: true, sponsorNotifiedAt: true, sponsorContactName: true, sponsorContactEmail: true },
    });
    if (!a || a.status !== 'PUBLISHED' || !a.sponsorVendorId || a.sponsorNotifiedAt) return;
    // Only genuinely SPONSORED pieces get the "your sponsored article is live"
    // message — gate on genre ALONE. A vendor's What's Hot article can carry a
    // sponsorVendorId (for the review flow + ad lock) AND a featured window
    // (sponsoredUntil), but it isn't a paid placement, so it must NOT get the
    // sponsored email — its go-live shows on the dashboard as "Posted …". Intake
    // always stamps genre='sponsored', so no real sponsored article is missed.
    if (a.genre !== 'sponsored') return;

    const vendor = await prisma.vendor.findUnique({
      where: { id: a.sponsorVendorId },
      select: { name: true, premium: true, contactEmail: true, contactName: true },
    });
    if (!vendor) return;

    // Address THIS article's submitter (pinned per-article — who placed this
    // order), then fall back to the vendor's curated phone-book contact / name.
    const contactName = a.sponsorContactName || vendor.contactName || vendor.name;
    const to = a.sponsorContactEmail || vendor.contactEmail;

    // Claim the one-time notify ATOMICALLY, so two rapid/concurrent publishes can't
    // both read null and both send. Only the winner proceeds; on email failure we
    // release the claim so a later publish can retry.
    const claim = await prisma.article.updateMany({ where: { id: a.id, sponsorNotifiedAt: null }, data: { sponsorNotifiedAt: new Date() } });
    if (claim.count === 0) return;

    // Admin-editable copy (/admin/email-templates → "Sponsored article live").
    // renderTemplate HTML-escapes every {tag} value, so the untrusted title/name
    // can't inject markup into the email.
    const url = `${process.env.SITE_URL || ''}/docs/article/${a.slug}`;
    const { subject, text, html } = await renderTemplate('sponsor_golive', { contactName, vendorName: vendor.name, articleTitle: a.title, url });

    if (vendor.premium && to) {
      const r = await sendEmail({ to, subject, text, html });
      if (r.ok) log.info('sponsor go-live email sent', { articleId: a.id, to: redact(to) });
      else await prisma.article.update({ where: { id: a.id }, data: { sponsorNotifiedAt: null } }); // release for retry
      return;
    }

    // Non-premium (or no email on file): leave the admin ready-to-send copy, with
    // the contact person + address to send it to.
    // (sponsorNotifiedAt was already claimed atomically above — if recording the
    // copy fails, RELEASE the claim so a later publish retries instead of the
    // article being marked notified with no copy ever recorded.)
    try {
      await prisma.adminLog.create({
        data: {
          kind: 'sponsor_golive',
          message: `Sponsored article “${a.title}” is live — send the go-live note to ${contactName}${to ? ` <${to}>` : ' (no email on file)'}:\n\n${text}`,
        },
      });
    } catch (e) {
      await prisma.article.update({ where: { id: a.id }, data: { sponsorNotifiedAt: null } });
      throw e;
    }
  } catch (e) {
    log.warn('sponsor go-live notify failed', { articleId, err: (e as Error).message });
  }
}
