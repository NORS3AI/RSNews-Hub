import { prisma } from './db';

export type ModuleId =
  | 'recommended'
  | 'categories'
  | 'trending'
  | 'latest'
  | 'ad-leaderboard'
  | 'ad-rectangles';

export type HomeModule = { id: ModuleId; enabled: boolean };

export const MODULE_CATALOG: Record<ModuleId, { label: string; description: string }> = {
  recommended: { label: 'Recommended for you', description: 'Personalized picks from reading history.' },
  categories: { label: 'Category strip', description: 'Quick links to every category.' },
  trending: { label: 'Trending / Most read', description: 'The most-viewed published articles.' },
  latest: { label: 'Latest articles', description: 'The main chronological grid of stories.' },
  'ad-leaderboard': { label: 'Ad — leaderboard', description: 'Full-width banner ad slot.' },
  'ad-rectangles': { label: 'Ad — rectangle row', description: 'A row of medium-rectangle ad slots.' },
};

// The hero/headline block is intentionally NOT in this list — it is always
// pinned to the very top and cannot be reordered.
export const DEFAULT_LAYOUT: HomeModule[] = [
  { id: 'recommended', enabled: true },
  { id: 'ad-leaderboard', enabled: true },
  { id: 'categories', enabled: true },
  { id: 'latest', enabled: true },
  { id: 'trending', enabled: true },
  { id: 'ad-rectangles', enabled: true },
];

const KEY = 'homepage_layout';

export async function getHomeLayout(): Promise<HomeModule[]> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_LAYOUT;
  try {
    const parsed = JSON.parse(row.value) as HomeModule[];
    // Validate + reconcile with the catalog: drop unknown ids, append any
    // newly-added modules that aren't in the saved layout yet.
    const known = parsed.filter((m) => m.id in MODULE_CATALOG);
    const present = new Set(known.map((m) => m.id));
    for (const def of DEFAULT_LAYOUT) if (!present.has(def.id)) known.push(def);
    return known.length ? known : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export async function saveHomeLayout(layout: HomeModule[]): Promise<void> {
  const clean = layout.filter((m) => m.id in MODULE_CATALOG).map((m) => ({ id: m.id, enabled: !!m.enabled }));
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: KEY, value: JSON.stringify(clean) },
  });
}
