import { prisma } from './db';

// The end-of-article "Recommend" endorsement. One row per reader per article
// (deduped by userId for signed-in readers, sessionId for anonymous ones);
// Article.recommends is the denormalized count kept in lockstep. Deleting the
// row toggles the recommend back off.

export type RecommendState = { recommends: number; recommended: boolean };

// A reader is EITHER a signed-in account or an anonymous reader-session. Exactly
// one key identifies them; the matching compound-unique dedups their row.
export type RecommendKey = { userId: string } | { sessionId: string };

/** Resolve the dedup key for the current reader, or null if we can't identify
 *  them (no account and no reader-session cookie → can't safely dedup). */
export function recommendKey(userId?: string | null, sessionId?: string | null): RecommendKey | null {
  if (userId) return { userId };
  if (sessionId) return { sessionId };
  return null;
}

function findRow(tx: typeof prisma, articleId: string, key: RecommendKey) {
  return 'userId' in key
    ? tx.articleRecommend.findUnique({ where: { articleId_userId: { articleId, userId: key.userId } } })
    : tx.articleRecommend.findUnique({ where: { articleId_sessionId: { articleId, sessionId: key.sessionId } } });
}

/** Toggle this reader's recommend on/off and return the fresh count + state.
 *  Runs in a transaction so the row and the denormalized count never diverge. */
export async function toggleRecommend(articleId: string, key: RecommendKey): Promise<RecommendState> {
  return prisma.$transaction(async (tx) => {
    const existing = await findRow(tx as typeof prisma, articleId, key);
    let recommended: boolean;
    if (existing) {
      await tx.articleRecommend.delete({ where: { id: existing.id } });
      recommended = false;
    } else {
      await tx.articleRecommend.create({
        data: { articleId, userId: 'userId' in key ? key.userId : null, sessionId: 'sessionId' in key ? key.sessionId : null },
      });
      recommended = true;
    }
    const art = await tx.article.update({
      where: { id: articleId },
      data: { recommends: { increment: recommended ? 1 : -1 } },
      select: { recommends: true },
    });
    // The count must never drift negative (defensive against a lost/duplicated row).
    if (art.recommends < 0) {
      await tx.article.update({ where: { id: articleId }, data: { recommends: 0 } });
      return { recommends: 0, recommended };
    }
    return { recommends: art.recommends, recommended };
  });
}

/** Count + whether THIS reader has recommended. Pass the article's already-loaded
 *  count when you have it (saves a query); otherwise it's fetched. */
export async function getRecommendState(articleId: string, key: RecommendKey | null, knownCount?: number): Promise<RecommendState> {
  const recommends = knownCount != null
    ? Math.max(0, knownCount)
    : Math.max(0, (await prisma.article.findUnique({ where: { id: articleId }, select: { recommends: true } }))?.recommends ?? 0);
  if (!key) return { recommends, recommended: false };
  const row = await findRow(prisma, articleId, key);
  return { recommends, recommended: !!row };
}
