import { prisma } from './db';
import { type NewsroomDocView } from './newsroom';

// Reads for the Newsroom page. Mutations live in actions.ts (server actions).
// The list is small by nature (a handful of in-flight drafts), so the page loads
// full doc bodies + their comment threads up front; the client's sync loop keeps
// presence, new comments, and "last edited" fresh from there. Returns the same
// NewsroomDocView shape the sync action returns, so the client has one type.

/** Active drafts (not archived, not yet pushed to the composer), newest edit first. */
export async function listNewsroomDocs(): Promise<NewsroomDocView[]> {
  const docs = await prisma.newsroomDoc.findMany({
    where: { archived: false, pushedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, body: true, updatedAt: true, updatedById: true, updatedByName: true, createdByName: true,
      comments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorName: true, body: true, createdAt: true },
      },
    },
  });
  return docs.map((d) => ({
    id: d.id, title: d.title, body: d.body, updatedAt: d.updatedAt.toISOString(),
    updatedById: d.updatedById, updatedByName: d.updatedByName, createdByName: d.createdByName,
    comments: d.comments.map((c) => ({ id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt.toISOString() })),
  }));
}
