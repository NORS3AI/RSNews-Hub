// Integration test for the digest / notification gate filter. gatherSince must
// never surface a tier-gated article (Premium, Package Hub, …) to a viewer who
// can't open it — most importantly the broadcast email digest, which passes no
// viewer and so must see ONLY open articles. Hits the real dev/CI DB; rows are
// namespaced by a unique slug prefix and cleaned up.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import { gatherSince, ALL } from './subscriptions';
import type { AccountLike } from './entitlements';

let seq = 0;
const tag = `gatetest-${Date.now().toString(36)}`;
const madeArticles: string[] = [];

async function mkArticle(requirement: string) {
  const a = await prisma.article.create({
    data: {
      title: `Gate ${requirement || 'open'} ${seq}`,
      slug: `${tag}-${requirement || 'open'}-${seq++}`,
      content: 'body',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      requirement,
    },
    select: { id: true, slug: true },
  });
  madeArticles.push(a.id);
  return a;
}

afterEach(async () => {
  if (madeArticles.length) { await prisma.article.deleteMany({ where: { id: { in: madeArticles } } }); madeArticles.length = 0; }
});

const since = new Date(Date.now() - 60_000);
const now = new Date(Date.now() + 60_000);

describe('gatherSince gate filter', () => {
  it('broadcast digest (no viewer) sees open articles but NOT gated ones', async () => {
    const open = await mkArticle('');
    const gated = await mkArticle('packagehub');
    const { articles } = await gatherSince([ALL], since, now, 100, null);
    const slugs = new Set(articles.map((a) => a.slug));
    expect(slugs.has(open.slug)).toBe(true);
    expect(slugs.has(gated.slug)).toBe(false);
  });

  it('a Package Hub member sees the Package-Hub-gated article', async () => {
    const gated = await mkArticle('packagehub');
    const viewer: AccountLike = { accountType: 'MEMBER', affiliations: 'packagehub' };
    const { articles } = await gatherSince([ALL], since, now, 100, viewer);
    expect(articles.some((a) => a.slug === gated.slug)).toBe(true);
  });

  it('a basic member does NOT see a Package-Hub-only article', async () => {
    const gated = await mkArticle('packagehub');
    const viewer: AccountLike = { accountType: 'MEMBER', tier: 'basic', affiliations: '' };
    const { articles } = await gatherSince([ALL], since, now, 100, viewer);
    expect(articles.some((a) => a.slug === gated.slug)).toBe(false);
  });

  it('a premium member sees a premium-gated article', async () => {
    const gated = await mkArticle('premium');
    const viewer: AccountLike = { accountType: 'MEMBER', tier: 'premium' };
    const { articles } = await gatherSince([ALL], since, now, 100, viewer);
    expect(articles.some((a) => a.slug === gated.slug)).toBe(true);
  });
});
