// Unified subscriptions — one model for two scopes, because a membership account
// is a whole store shared by owner + managers + employees:
//
//   • ON-SITE NOTIFICATIONS are ACCOUNT-WIDE. Whoever is logged in shares one
//     bell, so the followed topics live on the account (Subscription rows keyed
//     to userId). See getAccountTopics / setAccountTopics / notificationFeed.
//
//   • EMAIL DIGESTS are PER-PERSON. Any individual visiting under the shared
//     login can drop their own address so the digest reaches *their* inbox, each
//     with their own topic picks (NewsletterSubscriber rows, grouped by the
//     account that added them). See getAccountEmails / upsertDigestEmail.
//
// A "topic" is a small string key: 'industry' (Brandon's Industry News), 'all'
// (everything), or a category slug. This keeps the picker identical everywhere.

import { prisma } from './db';
import { linkSource } from './industry';
import { testimonialNudges } from './testimonials';
import { canViewContent, type AccountLike } from './entitlements';

export const INDUSTRY = 'industry';
export const ALL = 'all';
export type TopicKey = string; // 'industry' | 'all' | <category-slug>

export function parseTopics(csv: string | null | undefined): TopicKey[] {
  return (csv || '').split(',').map((s) => s.trim()).filter(Boolean);
}
export function serializeTopics(keys: TopicKey[]): string {
  return Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean))).join(',');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validEmail(s: string): boolean { return EMAIL_RE.test((s || '').trim()); }

function token(): string {
  try { return crypto.randomUUID().replace(/-/g, ''); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/** The full topic menu shown in the picker: Industry News pinned first, then
 *  every category. `count` is how many published articles the category holds. */
export async function topicMenu() {
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true, color: true,
      _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } },
    },
  });
  return {
    industry: { key: INDUSTRY, name: 'Industry News', color: '#E97D34' },
    categories: cats.map((c) => ({ key: c.slug, name: c.name, color: c.color, count: c._count.articles })),
  };
}

/** Resolve a set of topic keys into a concrete content filter. */
function resolveFilter(keys: TopicKey[]) {
  const set = new Set(keys);
  const all = set.has(ALL);
  const industry = all || set.has(INDUSTRY);
  const slugs = keys.filter((k) => k !== INDUSTRY && k !== ALL);
  return { all, industry, slugs };
}

/** Gather new content in the given topics between `since` and `now`. Shared by
 *  the email digest and the on-site notification feed. */
// `viewer` decides which gated articles are visible. Default `null` = only
// open ('' / public) articles — the safe choice for the broadcast email digest,
// which reaches unverified addresses and can't check any single recipient's
// tier. The on-site feed passes the signed-in account so a member sees exactly
// what they're entitled to (never a Premium/PackageHub headline they can't open).
export async function gatherSince(keys: TopicKey[], since: Date, now: Date, take = 40, viewer: AccountLike | null = null) {
  const f = resolveFilter(keys);
  const wantIndustry = f.industry;
  const wantArticles = f.all || f.slugs.length > 0;

  const [industry, articles] = await Promise.all([
    wantIndustry
      ? prisma.industryLink.findMany({ where: { active: true, postedAt: { gt: since, lte: now } }, orderBy: { postedAt: 'desc' }, take })
      : Promise.resolve([]),
    wantArticles
      ? prisma.article.findMany({
          where: {
            status: 'PUBLISHED', publishedAt: { gt: since, lte: now },
            // No viewer (broadcast digest) → let the DB return only open articles
            // so gated posts don't consume the `take` window and push public ones
            // out of range. The canViewContent pass below still guards every row.
            ...(viewer ? {} : { requirement: { in: ['', 'public', 'all'] } }),
            ...(f.all ? {} : { OR: [{ category: { slug: { in: f.slugs } } }, { extraCategories: { some: { slug: { in: f.slugs } } } }] }),
          },
          orderBy: { publishedAt: 'desc' }, take,
          select: { title: true, slug: true, publishedAt: true, requirement: true, category: { select: { name: true, color: true } } },
        })
      : Promise.resolve([]),
  ]);
  // Drop gated articles the viewer can't open, then project to exactly the fields
  // callers consume (the gate token itself never leaves this function).
  const visible = articles
    .filter((a) => canViewContent(viewer, a.requirement))
    .map((a) => ({ title: a.title, slug: a.slug, publishedAt: a.publishedAt, category: a.category }));
  return { industry, articles: visible };
}

// ─────────────────────────── Account notifications ──────────────────────────

/** Topic keys this account follows for the shared on-site bell. */
export async function getAccountTopics(userId: string): Promise<TopicKey[]> {
  const rows = await prisma.subscription.findMany({ where: { userId }, include: { category: { select: { slug: true } } } });
  return rows.map((r) => (r.kind === 'industry' ? INDUSTRY : r.kind === 'all' ? ALL : r.category?.slug)).filter(Boolean) as TopicKey[];
}

/** Replace the account's followed notification topics with `keys`. */
export async function setAccountTopics(userId: string, keys: TopicKey[]): Promise<void> {
  const want = new Set(keys); // dedups the incoming keys up front
  const catSlugs = Array.from(want).filter((k) => k !== ALL && k !== INDUSTRY);
  const cats = catSlugs.length ? await prisma.category.findMany({ where: { slug: { in: catSlugs } }, select: { id: true, slug: true } }) : [];

  const data: { userId: string; kind: string; categoryId: string | null }[] = [];
  if (want.has(ALL)) data.push({ userId, kind: 'all', categoryId: null });
  if (want.has(INDUSTRY)) data.push({ userId, kind: 'industry', categoryId: null });
  // Iterate the DB rows (one per slug) so a repeated slug can't create two rows
  // and trip the @@unique([userId,kind,categoryId]) constraint.
  for (const c of cats) data.push({ userId, kind: 'category', categoryId: c.id });

  // Atomic: never leave the account with its topics deleted if the insert fails.
  await prisma.$transaction([
    prisma.subscription.deleteMany({ where: { userId } }),
    ...(data.length ? [prisma.subscription.createMany({ data })] : []),
  ]);
}

export type FeedItem = {
  type: 'industry' | 'article' | 'testimonial';
  title: string; href: string; date: Date;
  meta?: string; categoryName?: string; categoryColor?: string; unread: boolean;
};

/** The shared account bell: recent items in followed topics, newest first, each
 *  flagged unread if it landed after the account last opened Notifications. */
export async function notificationFeed(userId: string, limit = 50): Promise<{ items: FeedItem[]; unread: number; hasTopics: boolean }> {
  const [keys, user, nudges] = await Promise.all([
    getAccountTopics(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true, accountType: true, tier: true, affiliations: true, vendorBrand: true } }),
    testimonialNudges(userId),
  ]);
  const now = new Date();
  const seenAt = user?.notificationsSeenAt ?? new Date(0);

  // Testimonial nudges reach a reader whether or not they follow any topics —
  // they're tied to suppliers the reader saved, not to topic subscriptions.
  const nudgeItems: FeedItem[] = nudges.map((n): FeedItem => ({
    type: 'testimonial',
    title: `Share your experience with ${n.vendorName}`,
    href: `/docs/suppliers/${n.vendorId}?recommend=1`,
    date: n.createdAt,
    meta: 'You saved them — a quick testimonial helps other stores',
    unread: n.createdAt > seenAt,
  }));

  if (!keys.length) {
    const items = nudgeItems.sort((a, b) => b.date.getTime() - a.date.getTime());
    return { items: items.slice(0, limit), unread: items.filter((i) => i.unread).length, hasTopics: false };
  }

  const since = new Date(now.getTime() - 60 * 24 * 3600 * 1000); // last 60 days of activity
  // Gather generously so the unread count reflects everything recent, not just
  // what fits the display slice (each source is capped, so pull extra).
  // Pass the signed-in account so the bell shows only what this member can open.
  const { industry, articles } = await gatherSince(keys, since, now, Math.max(limit, 100), user);

  const all: FeedItem[] = [
    ...nudgeItems,
    ...industry.map((l): FeedItem => ({
      type: 'industry', title: l.title, href: l.url, date: l.postedAt,
      meta: `${l.author} · ${linkSource(l.url, l.source)}`, unread: l.postedAt > seenAt,
    })),
    ...articles.map((a): FeedItem => ({
      type: 'article', title: a.title, href: `/docs/article/${a.slug}`, date: a.publishedAt ?? now,
      categoryName: a.category?.name, categoryColor: a.category?.color, unread: (a.publishedAt ?? now) > seenAt,
    })),
  ].sort((x, y) => y.date.getTime() - x.date.getTime());

  // Count unread across the full recent set (pre-slice) so the badge isn't
  // capped by the display limit.
  return { items: all.slice(0, limit), unread: all.filter((i) => i.unread).length, hasTopics: true };
}

/** Count only — cheap enough for the sidebar badge on every page. */
export async function unreadCount(userId: string): Promise<number> {
  const { unread } = await notificationFeed(userId);
  return unread;
}

export async function markNotificationsSeen(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { notificationsSeenAt: new Date() } });
}

// ─────────────────────────────── Email digests ──────────────────────────────

/** Every email this account has added to the digest list (for management UI). */
export async function getAccountEmails(userId: string) {
  return prisma.newsletterSubscriber.findMany({
    where: { accountId: userId, active: true }, orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, topics: true, createdAt: true },
  });
}

/** Add or update a digest email under this account. Editing an existing address
 *  (same email) just updates its topics — that's the "Customize" flow. */
export async function upsertDigestEmail(userId: string, emailRaw: string, keys: TopicKey[]): Promise<{ ok: boolean; error?: string }> {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!validEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
  const topics = serializeTopics(keys.length ? keys : [INDUSTRY]);
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    // Don't let one store touch an address another store owns — no reactivating
    // it, no rewriting its topics. Only the owning account (or an unclaimed row)
    // can be edited here.
    if (existing.accountId && existing.accountId !== userId) {
      return { ok: false, error: 'That email is already managed by another store account.' };
    }
    await prisma.newsletterSubscriber.update({ where: { email }, data: { topics, active: true, unsubscribedAt: null, accountId: userId } });
  } else {
    await prisma.newsletterSubscriber.create({ data: { email, topics, accountId: userId, source: 'hub', token: token() } });
  }
  return { ok: true };
}

/** Remove a digest email — only if it belongs to the requesting account. */
export async function removeDigestEmail(userId: string, id: string): Promise<{ ok: boolean }> {
  const row = await prisma.newsletterSubscriber.findUnique({ where: { id }, select: { id: true, accountId: true } });
  if (!row || row.accountId !== userId) return { ok: false };
  await prisma.newsletterSubscriber.delete({ where: { id } });
  return { ok: true };
}

export async function unsubscribeByToken(tok: string): Promise<{ ok: boolean; email?: string }> {
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { token: tok } });
  if (!sub) return { ok: false };
  if (sub.active) await prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { active: false, unsubscribedAt: new Date() } });
  return { ok: true, email: sub.email };
}
