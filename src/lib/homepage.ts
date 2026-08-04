import { prisma } from './db';

export type ModuleId =
  | 'recommended'
  | 'industry'
  | 'categories'
  | 'trending'
  | 'latest'
  | 'ad-leaderboard'
  | 'ad-rectangles';

export type HomeModule = { id: ModuleId; enabled: boolean; locked?: boolean };

export const MODULE_CATALOG: Record<ModuleId, { label: string; description: string }> = {
  recommended: { label: 'Recommended for you', description: 'Personalized picks from reading history.' },
  industry: { label: 'Industry News', description: 'Curated external links, hand-picked by staff.' },
  categories: { label: 'Category strip', description: 'Quick links to every category.' },
  trending: { label: 'Trending / Most read', description: 'The most-viewed published articles.' },
  latest: { label: 'Latest articles', description: 'The main chronological grid of stories.' },
  'ad-leaderboard': { label: 'Ad — leaderboard', description: 'Full-width banner ad slot.' },
  'ad-rectangles': { label: 'Ad — rectangle row', description: 'A row of medium-rectangle ad slots.' },
};

// The hero/headline block is intentionally NOT in this list — it is always
// pinned to the very top and cannot be reordered.
export const DEFAULT_LAYOUT: HomeModule[] = [
  { id: 'recommended', enabled: true, locked: false },
  { id: 'industry', enabled: true, locked: false },
  { id: 'ad-leaderboard', enabled: true, locked: false },
  { id: 'categories', enabled: true, locked: false },
  { id: 'latest', enabled: true, locked: false },
  { id: 'trending', enabled: true, locked: false },
  { id: 'ad-rectangles', enabled: true, locked: false },
];

const KEY = 'homepage_layout';

export async function getHomeLayout(): Promise<HomeModule[]> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_LAYOUT;
  try {
    const parsed = JSON.parse(row.value) as HomeModule[];
    // Validate + reconcile with the catalog: drop unknown ids, append any
    // newly-added modules that aren't in the saved layout yet.
    const known = parsed
      .filter((m) => m.id in MODULE_CATALOG)
      .map((m) => ({ id: m.id, enabled: !!m.enabled, locked: !!m.locked }));
    const present = new Set(known.map((m) => m.id));
    for (const def of DEFAULT_LAYOUT) if (!present.has(def.id)) known.push({ id: def.id, enabled: !!def.enabled, locked: !!def.locked });
    return known.length ? known : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// Reorder honoring locks: locked modules keep their absolute slot; the given
// order only rearranges the unlocked ones among the remaining slots.
export function applyReorder(current: HomeModule[], orderedIds: string[]): HomeModule[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  const proposedUnlocked = orderedIds
    .map((id) => byId.get(id as ModuleId))
    .filter((m): m is HomeModule => !!m && !m.locked);
  const out: HomeModule[] = [];
  let u = 0;
  for (let i = 0; i < current.length; i++) {
    out.push(current[i].locked ? current[i] : proposedUnlocked[u++] ?? current[i]);
  }
  return out;
}

export async function saveHomeLayout(layout: HomeModule[]): Promise<void> {
  const clean = layout
    .filter((m) => m.id in MODULE_CATALOG)
    .map((m) => ({ id: m.id, enabled: !!m.enabled, locked: !!m.locked }));
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: KEY, value: JSON.stringify(clean) },
  });
}
