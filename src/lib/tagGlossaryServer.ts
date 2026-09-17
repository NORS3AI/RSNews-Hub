import { unstable_cache, revalidateTag } from 'next/cache';
import { prisma } from './db';
import { splitVariants } from './houseStyle';
import { BUILTIN_GLOSSARY, type GlossaryEntry } from './suggestTags';

// Runtime source of the Tag glossary — the industry vocabulary the tag suggester
// draws on. Cached (small, rarely changes) and refreshed when an admin edits it.
// suggestTags.ts holds the built-in seed + fallback so suggestions always work.
const TAG = 'tag-glossary';

export const getTagGlossaryRows = unstable_cache(
  async () => prisma.tagGlossaryTerm.findMany({
    orderBy: [{ sortOrder: 'asc' }, { canonical: 'asc' }],
    select: { id: true, canonical: true, variants: true, builtin: true, enabled: true, sortOrder: true },
  }),
  ['tag-glossary-all'],
  { tags: [TAG] },
);

/** Enabled glossary terms in the suggester's shape. Falls back to the built-ins
 *  when the table is empty (e.g. before the seed), so the suggester is never bare. */
export async function getTagGlossary(): Promise<GlossaryEntry[]> {
  const all = await getTagGlossaryRows();
  if (!all.length) return BUILTIN_GLOSSARY;
  return all
    .filter((t) => t.enabled)
    .map((t) => ({ canonical: t.canonical, variants: splitVariants(t.variants) }));
}

/** Call after any term create/edit/enable/delete so the cache refreshes. */
export function revalidateTagGlossary() {
  revalidateTag(TAG);
}
