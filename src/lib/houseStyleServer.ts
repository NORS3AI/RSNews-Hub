import { unstable_cache, revalidateTag } from 'next/cache';
import { prisma } from './db';
import { splitVariants, BUILTIN_HOUSE_STYLE_RULES, type HouseStyleRule } from './houseStyle';

// Runtime source of the house-style rule book. Cached (it's small and rarely
// changes) and refreshed when an admin edits a rule. The pure houseStyle.ts holds
// the built-in seed + fallback so the checker always works.
const TAG = 'house-style';

export const getHouseStyleRuleRows = unstable_cache(
  async () => prisma.houseStyleRule.findMany({
    orderBy: [{ sortOrder: 'asc' }, { canonical: 'asc' }],
    select: { id: true, canonical: true, variants: true, forceLowercase: true, message: true, builtin: true, enabled: true, sortOrder: true },
  }),
  ['house-style-all'],
  { tags: [TAG] },
);

/** Enabled rules in the pure checker shape. Falls back to the built-ins when the
 *  table is empty (e.g. before the seed), so the checker is never left ruleless. */
export async function getHouseStyleRules(): Promise<HouseStyleRule[]> {
  const all = await getHouseStyleRuleRows();
  if (!all.length) return BUILTIN_HOUSE_STYLE_RULES;
  return all
    .filter((r) => r.enabled)
    .map((r) => ({ canonical: r.canonical, variants: splitVariants(r.variants), forceLowercase: r.forceLowercase, message: r.message }));
}

/** Call after any rule create/edit/enable/delete so the cache refreshes. */
export function revalidateHouseStyle() {
  revalidateTag(TAG);
}
