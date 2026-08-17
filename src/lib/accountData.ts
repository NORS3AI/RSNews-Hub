import { prisma } from './db';
import { getCurrentUser } from './auth';
import { isActiveVendor } from './vendors';

// Information layer for the account page. Returns null when there's no signed-in
// user (the page redirects to login); otherwise the user plus their subscriptions
// and recent reading history.
export async function getAccountData() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [subs, history] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: user.id }, include: { category: true } }),
    prisma.readingLog.findMany({
      where: { userId: user.id }, orderBy: { readAt: 'desc' }, take: 12, distinct: ['articleId'],
      include: { article: { select: { title: true, slug: true, status: true } } },
    }),
  ]);
  // Drives the "Ad dashboard" link — coupled to the same premium switch that
  // gates the dashboard itself, so a cut-off vendor sees no dead-end link.
  const vendorActive = await isActiveVendor(user);
  return { user, subs, history, vendorActive };
}

export type AccountPageData = NonNullable<Awaited<ReturnType<typeof getAccountData>>>;
