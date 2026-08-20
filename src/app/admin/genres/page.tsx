import { prisma } from '@/lib/db';
import GenreManager from '@/components/admin/GenreManager';

export const dynamic = 'force-dynamic';

// Admin: the editorial-genre list — the NATURE of a piece (Opinion, Update, or a
// custom one like History or Education), shown as a small badge. Add, rename,
// recolor, or archive them here; changes flow to every badge site-wide. Built-in
// genres keep their slug; the Sponsored genre is protected (it drives paid-content
// disclosure) so it can't be archived or deleted.
export default async function AdminGenres() {
  const list = await prisma.genre.findMany({
    orderBy: [{ archived: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, slug: true, label: true, color: true, builtin: true, archived: true },
  });
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Genres</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        The <b>nature</b> of a piece — separate from its topic categories — shown as a small badge (Opinion, Update, or your own like <b>History</b> or <b>Education</b>). Add one below and it appears in the article editor&apos;s Genre picker and on every card. <b>Sponsored</b> is protected: it powers the paid-content disclosure.
      </p>
      <GenreManager list={list} />
    </div>
  );
}
