import { prisma } from './db';
import { isCustomModuleId } from './studio';

export type ModuleId =
  | 'recommended'
  | 'feature-carousel'
  | 'industry'
  | 'comic'
  | 'council'
  | 'categories'
  | 'trending'
  | 'rediscover'
  | 'latest'
  | 'ad-leaderboard'
  | 'ad-rectangles';

// A module may carry an optional `source` (only meaningful for modules whose
// catalog entry declares `sources`), letting an admin choose which pool of
// articles it pulls from without changing the layout order.
// `id` is a catalog ModuleId OR a namespaced custom-module id (`custom:<id>`),
// so builder-made modules share the same ordered/lockable layout list.
// `span` is the module's width in row-units (1, 2 or 3). Modules pack into rows
// of up to 3 units and share each row proportionally; 3 = full width (its own
// row). Defaults to 3 so existing layouts are unchanged. Purely proportional —
// on narrow screens every module collapses to full width (see the homepage grid).
// `locked` freezes the module's position (reorder lock); `sizeLocked` freezes
// its width (so the ⅓/⅔/full control is disabled). Two independent locks, both
// toggleable from the on-homepage admin toolbar and the layout editor.
export type HomeModule = { id: string; enabled: boolean; locked?: boolean; sizeLocked?: boolean; source?: string; span?: number };

/** Clamp a stored span to 1–3; anything missing/invalid → 3 (full width). */
export function clampSpan(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : 3;
}

function isKnownId(id: string): boolean {
  return id in MODULE_CATALOG || isCustomModuleId(id);
}

export type ModuleSource = { value: string; label: string };
type ModuleDef = { label: string; description: string; sources?: ModuleSource[]; defaultSource?: string };

// Article-pool choices reused by configurable modules.
export const ARTICLE_SOURCES: ModuleSource[] = [
  { value: 'featured', label: 'Featured articles' },
  { value: 'latest', label: 'Latest articles' },
  { value: 'trending', label: 'Most read / trending' },
];

export const MODULE_CATALOG: Record<ModuleId, ModuleDef> = {
  recommended: { label: 'Recommended for you', description: 'Personalized picks from reading history.' },
  'feature-carousel': { label: 'Feature showcase', description: 'Big split banner — one story (title + image) at a time, paged left/right.', sources: ARTICLE_SOURCES, defaultSource: 'featured' },
  industry: { label: 'Industry News', description: 'Curated external links, hand-picked by staff.' },
  comic: { label: 'Backroom Humor comic', description: 'The current comic; the rest live in the archive.' },
  council: { label: 'RS Council column', description: 'A tall column showing the full text of every RS Council piece.' },
  categories: { label: 'Category strip', description: 'Quick links to every category.' },
  trending: { label: 'Trending / Most read', description: 'The most-opened articles over the last 7 days (falls back to all-time when traffic is thin).' },
  rediscover: { label: 'Rediscover', description: 'Older stories from the back catalog, rotating to a fresh set each day.' },
  latest: { label: 'Latest articles', description: 'The main chronological grid of stories.' },
  'ad-leaderboard': { label: 'Ad — leaderboard', description: 'Full-width banner ad slot.' },
  'ad-rectangles': { label: 'Ad — rectangle row', description: 'A row of medium-rectangle ad slots.' },
};

// The hero/headline block is intentionally NOT in this list — it is always
// pinned to the very top and cannot be reordered.
export const DEFAULT_LAYOUT: HomeModule[] = [
  { id: 'recommended', enabled: true, locked: false },
  { id: 'industry', enabled: true, locked: false },
  { id: 'feature-carousel', enabled: true, locked: false, source: 'featured' },
  { id: 'comic', enabled: true, locked: false },
  { id: 'council', enabled: true, locked: false },
  { id: 'ad-leaderboard', enabled: true, locked: false },
  { id: 'categories', enabled: true, locked: false },
  { id: 'latest', enabled: true, locked: false, span: 2 },
  { id: 'trending', enabled: true, locked: false, span: 1 },
  { id: 'rediscover', enabled: true, locked: false, span: 1 },
  { id: 'ad-rectangles', enabled: true, locked: false },
];

// Resolve a module's effective source, honoring the saved value but falling
// back to the catalog default (and ignoring values no longer offered).
export function moduleSource(m: HomeModule): string | undefined {
  const def = MODULE_CATALOG[m.id as ModuleId];
  if (!def || !def.sources) return undefined;
  const ok = m.source && def.sources.some((s) => s.value === m.source);
  return ok ? m.source : def.defaultSource ?? def.sources[0]?.value;
}

// The public homepage renders the LIVE layout; admins edit the DRAFT layout and
// publish it with "Go Live". When no draft exists, the draft mirrors live.
const KEY = 'homepage_layout';
const DRAFT_KEY = 'homepage_layout_draft';

// Parse + reconcile a stored layout with the catalog: drop unknown ids, append
// any newly-added catalog modules not yet present. Shared by live + draft reads.
function reconcile(value: string): HomeModule[] {
  const parsed = JSON.parse(value) as HomeModule[];
  const known = parsed
    .filter((m) => isKnownId(m.id))
    .map((m) => ({ id: m.id, enabled: !!m.enabled, locked: !!m.locked, span: clampSpan(m.span), ...(m.sizeLocked ? { sizeLocked: true } : {}), ...(m.source ? { source: m.source } : {}) }));
  const present = new Set(known.map((m) => m.id));
  for (const def of DEFAULT_LAYOUT) if (!present.has(def.id)) known.push({ ...def, enabled: !!def.enabled, locked: !!def.locked, span: clampSpan(def.span) });
  return known.length ? known : DEFAULT_LAYOUT;
}

function cleanLayout(layout: HomeModule[]) {
  return layout
    .filter((m) => isKnownId(m.id))
    .map((m) => ({ id: m.id, enabled: !!m.enabled, locked: !!m.locked, span: clampSpan(m.span), ...(m.sizeLocked ? { sizeLocked: true } : {}), ...(m.source ? { source: m.source } : {}) }));
}

// LIVE layout — what the public homepage renders.
export async function getHomeLayout(): Promise<HomeModule[]> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_LAYOUT;
  try {
    return reconcile(row.value);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// DRAFT layout — what admins edit. Falls back to the live layout when there is
// no draft yet (i.e. no pending changes).
export async function getDraftLayout(): Promise<HomeModule[]> {
  const row = await prisma.setting.findUnique({ where: { key: DRAFT_KEY } });
  if (row) {
    try { return reconcile(row.value); } catch { /* fall through to live */ }
  }
  return getHomeLayout();
}

export async function saveDraftLayout(layout: HomeModule[]): Promise<void> {
  const value = JSON.stringify(cleanLayout(layout));
  await prisma.setting.upsert({ where: { key: DRAFT_KEY }, update: { value }, create: { key: DRAFT_KEY, value } });
}

// Go Live: promote the draft to the live layout, then clear the draft.
export async function publishDraftLayout(): Promise<void> {
  const draft = await prisma.setting.findUnique({ where: { key: DRAFT_KEY } });
  if (!draft) return; // nothing pending
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: draft.value }, create: { key: KEY, value: draft.value } });
  await prisma.setting.deleteMany({ where: { key: DRAFT_KEY } });
}

export async function discardDraftLayout(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: DRAFT_KEY } });
}

// True when a draft exists AND differs from live (i.e. there are pending changes
// worth a "Go Live"). A draft equal to live is treated as no change.
export async function hasDraftChanges(): Promise<boolean> {
  const [draftRow, liveLayout] = await Promise.all([
    prisma.setting.findUnique({ where: { key: DRAFT_KEY } }),
    getHomeLayout(),
  ]);
  if (!draftRow) return false;
  try {
    return JSON.stringify(cleanLayout(reconcile(draftRow.value))) !== JSON.stringify(cleanLayout(liveLayout));
  } catch {
    return false;
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

// Reorder honoring BOTH locks and visibility: a module that is locked OR hidden
// keeps its absolute slot; only the enabled+unlocked modules are rearranged, in
// the order given. `orderedVisibleIds` is the new order of the currently-visible
// modules (what an admin dragged on the live homepage). Used by on-page arrange.
export function applyLiveReorder(current: HomeModule[], orderedVisibleIds: string[]): HomeModule[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  const idset = new Set(orderedVisibleIds);
  // Only modules the caller actually listed take part in the shuffle; a slot is a
  // "fill slot" only if its module is enabled, unlocked AND present in the list.
  // Enabled-but-omitted modules (e.g. one that rendered empty) stay pinned, so
  // the id→slot mapping can't drift.
  const movable = orderedVisibleIds
    .map((id) => byId.get(id))
    .filter((m): m is HomeModule => !!m && m.enabled && !m.locked);
  const isFill = (m: HomeModule) => m.enabled && !m.locked && idset.has(m.id);
  const out: HomeModule[] = [];
  let i = 0;
  for (const m of current) out.push(isFill(m) ? movable[i++] ?? m : m);
  return out;
}

// Persist an on-homepage drag: reorder LIVE (published immediately) and, if a
// pending draft exists, apply the same id-order to it — so a later "Go Live"
// can't silently revert what an admin just arranged on the page.
export async function reorderLiveLayout(orderedVisibleIds: string[]): Promise<void> {
  const live = await getHomeLayout();
  await saveHomeLayout(applyLiveReorder(live, orderedVisibleIds));
  const draftRow = await prisma.setting.findUnique({ where: { key: DRAFT_KEY } });
  if (draftRow) {
    try { await saveDraftLayout(applyLiveReorder(reconcile(draftRow.value), orderedVisibleIds)); }
    catch { /* leave a malformed draft alone */ }
  }
}

export async function saveHomeLayout(layout: HomeModule[]): Promise<void> {
  const clean = cleanLayout(layout);
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: KEY, value: JSON.stringify(clean) },
  });
}

// Apply a mutation to one module in the LIVE layout (published immediately) and,
// if a pending draft exists, the same module in the draft — so an in-context
// toggle from the live homepage takes effect now AND survives a later Go Live.
// Used by the on-homepage admin toolbar (locks), where staging via draft would
// be invisible (the homepage renders live).
export async function patchModuleLive(id: string, patch: (m: HomeModule) => void): Promise<void> {
  const live = await getHomeLayout();
  const lm = live.find((x) => x.id === id);
  if (lm) { patch(lm); await saveHomeLayout(live); }
  const draftRow = await prisma.setting.findUnique({ where: { key: DRAFT_KEY } });
  if (draftRow) {
    try {
      const draft = reconcile(draftRow.value);
      const dm = draft.find((x) => x.id === id);
      if (dm) { patch(dm); await saveDraftLayout(draft); }
    } catch { /* leave a malformed draft alone */ }
  }
}
