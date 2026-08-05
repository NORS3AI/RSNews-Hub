// Admin-editable email copy. Each purpose has a template (subject + plain-text
// body with {mergeTags}); the admin can override the built-in default in
// /admin/email-templates. The sender substitutes the vendor's values and renders
// both a text and a branded-HTML version (links auto-linked, values HTML-escaped).
//
// The registry below is the source of truth for which templates exist, their
// available tags, and the default copy. Adding a new email type = a new entry
// here + calling renderTemplate(key, vars) where it's sent.

import { prisma } from './db';
import { renderEmail, escapeHtml } from './email';

export type TemplateTag = { tag: string; desc: string };
export type TemplateDef = { key: string; label: string; description: string; tags: TemplateTag[]; subject: string; body: string };

const SUBMIT_TAG: TemplateTag = { tag: 'submitUrl', desc: 'Link to your JotForm ad-order form (set AD_ORDER_URL, or paste a link)' };
const VENDOR_TAG: TemplateTag = { tag: 'vendorName', desc: 'The advertiser’s name' };
const PACKAGE_TAG: TemplateTag = { tag: 'packageLabel', desc: 'Their package, e.g. “6-Month”' };
const DATE_TAG: TemplateTag = { tag: 'date', desc: 'The relevant date (flight start, or campaign end)' };
const DAYS_TAG: TemplateTag = { tag: 'daysUntil', desc: 'Whole days until that date' };

export const EMAIL_TEMPLATES: Record<string, TemplateDef> = {
  fresh_ads: {
    key: 'fresh_ads',
    label: 'Fresh ads needed',
    description: 'Sent when a vendor’s next flight is coming up and still needs its creatives.',
    tags: [VENDOR_TAG, { tag: 'batchOrdinal', desc: 'Which batch, spelled out: “second”' }, { tag: 'batchNumber', desc: 'Which batch as a number: “2”' }, PACKAGE_TAG, DATE_TAG, DAYS_TAG, SUBMIT_TAG],
    subject: 'Time to send your next set of ads, {vendorName}',
    body:
`Hi {vendorName},

We’re ready for the {batchOrdinal} batch of 3 ads in your {packageLabel} cycle. Your next flight goes live on {date} — about {daysUntil} days from now.

Submit your 3 new ads here: {submitUrl}

Once we receive them, your ads should go live within one work week.

Thanks for advertising with RS News!`,
  },
  renewal: {
    key: 'renewal',
    label: 'Renewal',
    description: 'Sent when a vendor’s campaign is nearing its end, to prompt the next order.',
    tags: [VENDOR_TAG, PACKAGE_TAG, DATE_TAG, DAYS_TAG, SUBMIT_TAG],
    subject: 'Your RS News ads wrap up {date} — renew to keep running',
    body:
`Hi {vendorName},

Your {packageLabel} run with RS News ends on {date} — about {daysUntil} days from now. Renew now so your ads keep running without a gap.

Place your next order here: {submitUrl}

New ads typically go live within one work week of being submitted.

Thanks — we’d love to keep you running!`,
  },
};

export type TemplateVars = Record<string, string>;
export type BuiltEmail = { subject: string; text: string; html: string };

const TAG_RE = /\{(\w+)\}/g;

/** Replace {tags} with values. Unknown tags are left literal (so a typo is
 *  visible). When `esc`, values are HTML-escaped (for the HTML body). */
function applyVars(tpl: string, vars: TemplateVars, esc: boolean): string {
  return tpl.replace(TAG_RE, (whole, name: string) => {
    if (!(name in vars)) return whole;
    const v = vars[name] ?? '';
    return esc ? escapeHtml(v) : v;
  });
}

/** Turn already-escaped plain text into paragraphs + clickable links. */
function toHtmlBody(escapedText: string): string {
  const linked = escapedText.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#E97D34">$1</a>');
  return linked
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Render a subject + body template with vars into subject/text/HTML. Pure. */
export function renderCopy(subject: string, body: string, vars: TemplateVars): BuiltEmail {
  const subjectOut = applyVars(subject, vars, false);
  const text = applyVars(body, vars, false);
  const html = renderEmail(subjectOut, toHtmlBody(applyVars(escapeHtml(body), vars, true)));
  return { subject: subjectOut, text, html };
}

/** The current copy for a key: the admin's override if any, else the default. */
export async function loadTemplateCopy(key: string): Promise<{ subject: string; body: string }> {
  const def = EMAIL_TEMPLATES[key];
  const row = await prisma.emailTemplate.findUnique({ where: { key }, select: { subject: true, body: true } });
  return { subject: row?.subject ?? def?.subject ?? '', body: row?.body ?? def?.body ?? '' };
}

/** Render a stored/default template for a key with the given vars. */
export async function renderTemplate(key: string, vars: TemplateVars): Promise<BuiltEmail> {
  const { subject, body } = await loadTemplateCopy(key);
  return renderCopy(subject, body, vars);
}

/** Sample values for the admin preview. */
export function sampleVars(key: string): TemplateVars {
  const submitUrl = process.env.AD_ORDER_URL || 'https://form.jotform.com/your-ad-form';
  if (key === 'renewal') return { vendorName: 'PackWise', packageLabel: '12-Month', date: 'December 31, 2026', daysUntil: '21', submitUrl };
  return { vendorName: 'PackWise', batchOrdinal: 'second', batchNumber: '2', packageLabel: '6-Month', date: 'September 1, 2026', daysUntil: '14', submitUrl };
}
