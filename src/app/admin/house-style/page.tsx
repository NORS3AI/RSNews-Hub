import { getHouseStyleRuleRows } from '@/lib/houseStyleServer';
import HouseStyleManager from '@/components/admin/HouseStyleManager';

export const dynamic = 'force-dynamic';

// Admin: the house-style rule book — the dictionary the Newsroom's style checker
// enforces. Each rule is a correct spelling plus the off-house variants to catch
// (plain text, never regex). Built-in rules can be edited or turned off but not
// deleted; add your own on top.
export default async function AdminHouseStyle() {
  const list = await getHouseStyleRuleRows();
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">House style</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        The rule book the <b>Newsroom</b> style checker enforces. Give each term its correct spelling and the off-house versions to flag (e.g. correct <b>e-commerce</b>, catch <i>ecommerce</i>, <i>e commerce</i>). The checker highlights matches in a draft and offers one-click fixes — it never rewrites anything on its own. The Oxford comma is always checked.
      </p>
      <HouseStyleManager list={list} />
    </div>
  );
}
