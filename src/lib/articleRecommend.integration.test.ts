// Integration tests for the end-of-article "Recommend" — these hit the DB, so
// they lock in behaviour a pure unit test can't: per-reader dedup (a second tap
// toggles off, not double-counts), signed-in vs anonymous keys being
// independent, the denormalized Article.recommends staying in lockstep, and
// mostRecommendedArticles ranking only endorsed pieces. Rows are namespaced and
// cleaned up, so it's safe against a shared DB.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import { toggleRecommend, getRecommendState } from './articleRecommend';
import { mostRecommendedArticles } from './recommend';

let seq = 0;
const tag = () => `rec-${Date.now().toString(36)}-${seq++}`;
const madeArticles: string[] = [];
const madeUsers: string[] = [];

async function mkArticle(recommends = 0) {
  const t = tag();
  const a = await prisma.article.create({
    data: { title: `T ${t}`, slug: `s-${t}`, content: '<p>body</p>', status: 'PUBLISHED', publishedAt: new Date(Date.now() - 1000), recommends },
  });
  madeArticles.push(a.id);
  return a;
}

// A real User row — ArticleRecommend.userId is FK-constrained, so signed-in
// recommends must reference a live account.
async function mkUser() {
  const t = tag();
  const u = await prisma.user.create({ data: { email: `${t}@example.com`, name: `U ${t}` } });
  madeUsers.push(u.id);
  return u.id;
}

afterEach(async () => {
  if (madeArticles.length) {
    // ArticleRecommend rows cascade on the article delete.
    await prisma.article.deleteMany({ where: { id: { in: madeArticles } } });
    madeArticles.length = 0;
  }
  if (madeUsers.length) {
    await prisma.user.deleteMany({ where: { id: { in: madeUsers } } });
    madeUsers.length = 0;
  }
});

describe('toggleRecommend', () => {
  it('toggles on then off, keeping the denormalized count in lockstep', async () => {
    const a = await mkArticle();
    const userId = await mkUser();
    const on = await toggleRecommend(a.id, { userId });
    expect(on).toEqual({ recommends: 1, recommended: true });
    expect((await prisma.article.findUnique({ where: { id: a.id }, select: { recommends: true } }))!.recommends).toBe(1);

    // Same reader taps again → toggles OFF (never double-counts).
    const off = await toggleRecommend(a.id, { userId });
    expect(off).toEqual({ recommends: 0, recommended: false });
    expect(await prisma.articleRecommend.count({ where: { articleId: a.id } })).toBe(0);
  });

  it('dedups per reader — two readers each add one, one reader tapping twice is net zero', async () => {
    const a = await mkArticle();
    const u1 = await mkUser();
    await toggleRecommend(a.id, { userId: u1 });
    await toggleRecommend(a.id, { userId: await mkUser() });
    const s = await toggleRecommend(a.id, { userId: u1 }); // u1 toggles back off
    expect(s.recommends).toBe(1); // only u2 remains
  });

  it('signed-in and anonymous keys are independent (both count)', async () => {
    const a = await mkArticle();
    await toggleRecommend(a.id, { userId: await mkUser() });
    const s = await toggleRecommend(a.id, { sessionId: 'sess-' + tag() });
    expect(s.recommends).toBe(2);
  });

  it('reflects the caller state via getRecommendState', async () => {
    const a = await mkArticle();
    const key = { sessionId: 'sess-' + tag() };
    await toggleRecommend(a.id, key);
    expect(await getRecommendState(a.id, key)).toEqual({ recommends: 1, recommended: true });
    expect(await getRecommendState(a.id, { sessionId: 'other-' + tag() })).toEqual({ recommends: 1, recommended: false });
    expect(await getRecommendState(a.id, null)).toEqual({ recommends: 1, recommended: false });
  });
});

describe('mostRecommendedArticles', () => {
  it('ranks by recommends desc and excludes unendorsed (recommends = 0) articles', async () => {
    const zero = await mkArticle(0);
    const low = await mkArticle(2);
    const high = await mkArticle(9);
    const ids = (await mostRecommendedArticles(50)).map((c) => c.id);
    expect(ids).not.toContain(zero.id);          // 0 recommends → excluded
    expect(ids.indexOf(high.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(low.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(high.id)).toBeLessThan(ids.indexOf(low.id)); // 9 ranks above 2
  });
});
