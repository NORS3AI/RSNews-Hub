import { unstable_cache, revalidateTag } from 'next/cache';
import { prisma } from './db';
import { type GenreInfo } from './genre';

// Runtime genre list — the source of truth. Cached across requests (the list is
// tiny and rarely changes) and refreshed when an admin edits a genre. Badges
// resolve their label/color through here; the pure genre.ts is the fallback.
const TAG = 'genres';

export const getGenres = unstable_cache(
  async () => prisma.genre.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, slug: true, label: true, color: true, builtin: true, archived: true, sortOrder: true },
  }),
  ['genres-all'],
  { tags: [TAG] },
);

/** Active (non-archived) genres — for the composer picker. */
export async function getActiveGenres() {
  return (await getGenres()).filter((g) => !g.archived);
}

/** slug → display info, for resolving genre badges (includes archived so an
 *  article carrying a since-archived genre still shows its label). */
export async function getGenreMap(): Promise<Record<string, GenreInfo>> {
  const map: Record<string, GenreInfo> = {};
  for (const g of await getGenres()) map[g.slug] = { slug: g.slug, label: g.label, color: g.color };
  return map;
}

/** The set of slugs a save is allowed to store. */
export async function validGenreSlugs(): Promise<Set<string>> {
  return new Set((await getGenres()).map((g) => g.slug));
}

/** Call after any genre create/edit/archive so the cache refreshes. */
export function revalidateGenres() {
  revalidateTag(TAG);
}
