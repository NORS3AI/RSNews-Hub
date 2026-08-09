// Email digest — one email per address, personalized to the topics that address
// picked. Because a hub login is shared across a whole store, the digest is keyed
// to the email (NewsletterSubscriber), not the account: five employees can each
// get their own headlines. Gathers what's new since the last send and goes out at
// most once a day; a quiet day for a given subscriber sends them nothing.
//
// Delivery rides on lib/email.ts (SendGrid or Resend; set EMAIL_FROM + a provider
// key). When email isn't configured it logs safely instead of sending.

import { prisma } from './db';
import { siteUrl } from './env';
import { sendEmail, renderEmail, escapeHtml, isEmailConfigured } from './email';
import { linkSource } from './industry';
import { parseTopics, gatherSince, ALL, INDUSTRY, type TopicKey } from './subscriptions';

const LAST_DIGEST_KEY = 'newsletter:lastDigestAt';
function base(): string { return (siteUrl || '').replace(/\/$/, ''); }

async function lastDigestAt(): Promise<Date> {
  const row = await prisma.setting.findUnique({ where: { key: LAST_DIGEST_KEY } });
  if (row?.value) { const d = new Date(row.value); if (!isNaN(d.getTime())) return d; }
  return new Date(Date.now() - 24 * 3600 * 1000); // first run: last 24h
}
async function setCheckpoint(now: Date): Promise<void> {
  await prisma.setting.upsert({ where: { key: LAST_DIGEST_KEY }, update: { value: now.toISOString() }, create: { key: LAST_DIGEST_KEY, value: now.toISOString() } });
}

type Gathered = Awaited<ReturnType<typeof gatherSince>>;
function itemCount(g: Gathered) { return g.industry.length + g.articles.length; }

function digestHtml(g: Gathered, unsubUrl: string): string {
  const b = base();
  const row = (title: string, href: string, meta: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">` +
    `<a href="${escapeHtml(href)}" style="color:#232a36;font-weight:700;font-size:16px;text-decoration:none">${escapeHtml(title)}</a>` +
    (meta ? `<div style="color:#8a8f98;font-size:13px;margin-top:2px">${escapeHtml(meta)}</div>` : '') + `</td></tr>`;
  let body = '';
  if (g.industry.length) {
    body += `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#E97D34;margin:18px 0 6px">Industry News</h2><table role="presentation" width="100%">`;
    body += g.industry.map((l) => row(l.title, l.url, `${l.author} · ${linkSource(l.url, l.source)}`)).join('');
    body += `</table>`;
  }
  if (g.articles.length) {
    body += `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#E97D34;margin:22px 0 6px">New on RS News Hub</h2><table role="presentation" width="100%">`;
    body += g.articles.map((a) => row(a.title, `${b}/docs/article/${a.slug}`, a.category?.name || '')).join('');
    body += `</table>`;
  }
  body += `<p style="color:#8a8f98;font-size:12px;margin-top:22px">You're getting this RS News Hub digest for the topics you picked. <a href="${escapeHtml(unsubUrl)}" style="color:#8a8f98">Unsubscribe</a>.</p>`;
  return renderEmail('Your RS News Hub digest', body);
}

/** Send each active subscriber their own digest for their own topics. Skips a
 *  subscriber with nothing new; records the checkpoint once at the end. */
export async function sendDailyDigests(opts: { force?: boolean } = {}): Promise<{ sent: number; failed: number; skippedEmpty: number; subscribers: number }> {
  const since = await lastDigestAt();
  const now = new Date();
  const subs = await prisma.newsletterSubscriber.findMany({ where: { active: true }, select: { email: true, token: true, topics: true } });

  let sent = 0, failed = 0, skippedEmpty = 0;
  for (const s of subs) {
    // Isolate each send: one subscriber's failure (thrown or returned) must not
    // abort the batch, or a mid-loop throw would skip the checkpoint and re-send
    // to everyone already emailed on the next run.
    try {
      const keys: TopicKey[] = parseTopics(s.topics);
      const g = await gatherSince(keys.length ? keys : [INDUSTRY], since, now, 40);
      if (!opts.force && itemCount(g) === 0) { skippedEmpty++; continue; }
      const unsub = `${base()}/newsletter/unsubscribe?token=${s.token}`;
      const n = itemCount(g);
      const r = await sendEmail({ to: s.email, subject: `RS News Hub — ${n} update${n === 1 ? '' : 's'}`, html: digestHtml(g, unsub) });
      if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }
  await setCheckpoint(now);
  return { sent, failed, skippedEmpty, subscribers: subs.length };
}

/** One-off sample to a single address (last 7 days, that address's topics if it
 *  already subscribes, else everything) so an admin can confirm delivery. */
export async function sendTestTo(emailRaw: string): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email }, select: { topics: true, token: true } });
  const keys: TopicKey[] = existing ? parseTopics(existing.topics) : [ALL];
  const g = await gatherSince(keys.length ? keys : [ALL], new Date(Date.now() - 7 * 24 * 3600 * 1000), new Date(), 40);
  const unsub = `${base()}/newsletter/unsubscribe?token=${existing?.token || 'test'}`;
  const r = await sendEmail({ to: email, subject: `[Test] RS News Hub — ${itemCount(g)} update${itemCount(g) === 1 ? '' : 's'}`, html: digestHtml(g, unsub) });
  return { ok: r.ok, skipped: r.skipped, error: r.error };
}

export async function newsletterStatus() {
  const now = new Date();
  const [total, active, last] = await Promise.all([
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { active: true } }),
    prisma.setting.findUnique({ where: { key: LAST_DIGEST_KEY } }),
  ]);
  const since = last?.value ? new Date(last.value) : new Date(now.getTime() - 24 * 3600 * 1000);
  const g = await gatherSince([ALL], since, now, 40); // everything new — the max any subscriber could receive
  return { total, active, lastSentAt: last?.value ? new Date(last.value) : null, pending: itemCount(g), emailReady: isEmailConfigured() };
}
