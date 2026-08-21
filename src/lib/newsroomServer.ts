import { prisma } from './db';
import { type NewsroomDocView, type NewsroomDocSummary, type NewsroomFlaggedDraft } from './newsroom';

// Reads for the Newsroom. Mutations live in actions.ts (server actions).
// The landing is a LIST (light rows, no bodies) so it scales to dozens of drafts;
// a draft's full body + comment thread load only when it's opened in the editor,
// where the client's sync loop keeps presence + notes fresh.

/** Active drafts (not archived, not pushed) as light list rows, newest edit first.
 *  `userId` marks which rows the current staffer has flagged (for the star column). */
export async function listNewsroomDocSummaries(userId?: string): Promise<NewsroomDocSummary[]> {
  const rows = await prisma.newsroomDoc.findMany({
    where: { archived: false, pushedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, createdByName: true, updatedByName: true, createdAt: true, updatedAt: true,
      _count: { select: { comments: true } },
      flags: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });
  return rows.map((d) => ({
    id: d.id, title: d.title, createdByName: d.createdByName, updatedByName: d.updatedByName,
    createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(), commentCount: d._count.comments,
    flaggedByMe: Array.isArray(d.flags) && d.flags.length > 0,
  }));
}

/** The drafts the given staffer has flagged (pinned), newest edit first. Powers the
 *  editor's quick-switcher rail. Excludes archived/pushed drafts (they've left). */
export async function listMyFlaggedDrafts(userId: string): Promise<NewsroomFlaggedDraft[]> {
  if (!userId) return [];
  const rows = await prisma.newsroomDoc.findMany({
    where: { archived: false, pushedAt: null, flags: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true },
  });
  return rows.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt.toISOString() }));
}

/** One draft's full body + comment thread, for the editor. Null if gone/pushed. */
export async function getNewsroomDoc(id: string): Promise<NewsroomDocView | null> {
  const d = await prisma.newsroomDoc.findUnique({
    where: { id },
    select: {
      id: true, title: true, body: true, archived: true, pushedAt: true, updatedAt: true, updatedById: true, updatedByName: true, createdByName: true,
      comments: { orderBy: { createdAt: 'asc' }, select: { id: true, authorName: true, body: true, quote: true, quoteStart: true, createdAt: true } },
    },
  });
  if (!d || d.archived || d.pushedAt) return null;
  return {
    id: d.id, title: d.title, body: d.body, updatedAt: d.updatedAt.toISOString(),
    updatedById: d.updatedById, updatedByName: d.updatedByName, createdByName: d.createdByName,
    comments: d.comments.map((c) => ({ id: c.id, authorName: c.authorName, body: c.body, quote: c.quote, quoteStart: c.quoteStart, createdAt: c.createdAt.toISOString() })),
  };
}
