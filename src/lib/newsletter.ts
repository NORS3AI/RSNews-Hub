// Newsletter — open email signups + a once-daily "Industry News" digest.
//
// Anyone can subscribe with just an email (owners, but also managers/employees
// who aren't the account holder). The digest gathers what's new since the last
// send and goes out at most once a day; a quiet day sends nothing. Delivery
// rides on lib/email.ts, which already supports SendGrid (set EMAIL_FROM +
// SENDGRID_API_KEY) and safely logs when unconfigured.

import { prisma } from './db';
import { siteUrl } from './env';
import { sendEmail, renderEmail, escapeHtml, isEmailConfigured } from './email';
import { linkSource } from './industry';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_DIGEST_KEY = 'newsletter:lastDigestAt';

function token(): string {
  try { return crypto.randomUUID().replace(/-/g, ''); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}
function base(): string { return (siteUrl || '').replace(/\/$/, ''); }

export async function subscribeEmail(emailRaw: string, source = 'homepage'): Promise<{ ok: boolean; error?: string }> {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    if (!existing.active) await prisma.newsletterSubscriber.update({ where: { email }, data: { active: true, unsubscribedAt: null } });
    return { ok: true };
  }
  await prisma.newsletterSubscriber.create({ data: { email, source, token: token() } });
  return { ok: true };
}

export async function unsubscribeByToken(tok: string): Promise<{ ok: boolean; email?: string }> {
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { token: tok } });
  if (!sub) return { ok: false };
  if (sub.active) await prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { active: false, unsubscribedAt: new Date() } });
  return { ok: true, email: sub.email };
}

async function lastDigestAt(): Promise<Date> {
  const row = await prisma.setting.findUnique({ where: { key: LAST_DIGEST_KEY } });
  if (row?.value) { const d = new Date(row.value); if (!isNaN(d.getTime())) return d; }
  return new Date(Date.now() - 24 * 3600 * 1000); // first run: last 24h
}

/** What's new since the last digest — the content that would be sent. */
export async function composeDigest(sinceOverride?: Date) {
  const since = sinceOverride ?? (await lastDigestAt());
  const now = new Date();
  const [industry, articles] = await Promise.all([
    prisma.industryLink.findMany({ where: { active: true, postedAt: { gt: since, lte: now } }, orderBy: { postedAt: 'desc' }, take: 40 }),
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { gt: since, lte: now } }, orderBy: { publishedAt: 'desc' }, take: 20, select: { title: true, slug: true } }),
  ]);
  return { since, now, industry, articles, count: industry.length + articles.length };
}

function digestHtml(d: Awaited<ReturnType<typeof composeDigest>>, unsubUrl: string): string {
  const b = base();
  const item = (title: string, href: string, meta: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">` +
    `<a href="${escapeHtml(href)}" style="color:#232a36;font-weight:700;font-size:16px;text-decoration:none">${escapeHtml(title)}</a>` +
    (meta ? `<div style="color:#8a8f98;font-size:13px;margin-top:2px">${escapeHtml(meta)}</div>` : '') + `</td></tr>`;
  let body = '';
  if (d.industry.length) {
    body += `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#E97D34;margin:18px 0 6px">Industry News</h2><table role="presentation" width="100%">`;
    body += d.industry.map((l) => item(l.title, l.url, `${l.author} · ${linkSource(l.url, l.source)}`)).join('');
    body += `</table>`;
  }
  if (d.articles.length) {
    body += `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#E97D34;margin:22px 0 6px">New on RSNews Hub</h2><table role="presentation" width="100%">`;
    body += d.articles.map((a) => item(a.title, `${b}/docs/article/${a.slug}`, '')).join('');
    body += `</table>`;
  }
  body += `<p style="color:#8a8f98;font-size:12px;margin-top:22px">You're getting this daily Industry News digest from RSNews Hub. <a href="${escapeHtml(unsubUrl)}" style="color:#8a8f98">Unsubscribe</a>.</p>`;
  return renderEmail('Today’s Industry News', body);
}

/** Send the digest to all active subscribers. Skips silently if nothing new (unless force). */
export async function sendDigest(opts: { force?: boolean } = {}): Promise<{ sent: number; failed: number; subscribers: number; count: number; skipped?: boolean }> {
  const d = await composeDigest();
  const subs = await prisma.newsletterSubscriber.findMany({ where: { active: true }, select: { email: true, token: true } });
  if (!opts.force && d.count === 0) {
    // Nothing new — record the checkpoint anyway so we don't re-scan the same window.
    await prisma.setting.upsert({ where: { key: LAST_DIGEST_KEY }, update: { value: d.now.toISOString() }, create: { key: LAST_DIGEST_KEY, value: d.now.toISOString() } });
    return { sent: 0, failed: 0, subscribers: subs.length, count: 0, skipped: true };
  }
  let sent = 0, failed = 0;
  for (const s of subs) {
    const unsub = `${base()}/newsletter/unsubscribe?token=${s.token}`;
    const r = await sendEmail({ to: s.email, subject: `Industry News — ${d.count} update${d.count === 1 ? '' : 's'}`, html: digestHtml(d, unsub) });
    if (r.ok) sent++; else failed++;
  }
  await prisma.setting.upsert({ where: { key: LAST_DIGEST_KEY }, update: { value: d.now.toISOString() }, create: { key: LAST_DIGEST_KEY, value: d.now.toISOString() } });
  return { sent, failed, subscribers: subs.length, count: d.count };
}

/** Send a one-off sample digest to a single address (last 7 days of content) so
 *  an admin can confirm SendGrid is wired up. Doesn't touch the daily checkpoint. */
export async function sendTestTo(emailRaw: string): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const d = await composeDigest(new Date(Date.now() - 7 * 24 * 3600 * 1000));
  const unsub = `${base()}/newsletter/unsubscribe?token=test`;
  const r = await sendEmail({ to: email, subject: `[Test] Industry News — ${d.count} update${d.count === 1 ? '' : 's'}`, html: digestHtml(d, unsub) });
  return { ok: r.ok, skipped: r.skipped, error: r.error };
}

export async function newsletterStatus() {
  const [total, active, last, preview] = await Promise.all([
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { active: true } }),
    prisma.setting.findUnique({ where: { key: LAST_DIGEST_KEY } }),
    composeDigest(),
  ]);
  return { total, active, lastSentAt: last?.value ? new Date(last.value) : null, pending: preview.count, emailReady: isEmailConfigured() };
}
