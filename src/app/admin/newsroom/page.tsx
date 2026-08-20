import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listNewsroomDocSummaries } from '@/lib/newsroomServer';
import NewsroomList from '@/components/admin/newsroom/NewsroomList';

export const dynamic = 'force-dynamic';

// Admin → Newsroom (landing): a full LIST of the shared drafts (scales to dozens,
// sortable), plus a list of the articles the logged-in staffer has authored. Click
// a draft to open it in the editor. Any staffer (ADMIN or EDITOR) can open and edit
// any draft.
export default async function NewsroomPage() {
  const user = await getCurrentUser();
  const me = user ? { id: user.id, name: user.name } : { id: '', name: 'You' };
  const [drafts, myArticles] = await Promise.all([
    listNewsroomDocSummaries(),
    user
      ? prisma.article.findMany({ where: { authorId: user.id }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, title: true, status: true, updatedAt: true, publishedAt: true } })
      : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Newsroom</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A shared scratchpad for drafting stories together. Everything autosaves, everyone with admin can see and edit, and one button hands a finished draft to the article editor. Open a draft to write; draft the words here and add formatting, images, and blocks after you push.
        </p>
      </div>
      <NewsroomList
        drafts={drafts}
        myArticles={myArticles.map((a) => ({ id: a.id, title: a.title, status: a.status, updatedAt: a.updatedAt.toISOString(), publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null }))}
        me={me}
      />
    </div>
  );
}
