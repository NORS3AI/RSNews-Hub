// Module Studio — the composition-tree model shared by the builder UI, the
// server actions that persist it, and the renderer that draws it. Kept pure and
// dependency-free so it can be unit-tested and imported from both client and
// server. See MODULE_STUDIO.md for the product spec.

/* ------------------------------- Containers ------------------------------ */

export type Shape = 'column' | 'sidebar' | 'row' | 'grid' | 'card';

export type ShapeDef = { label: string; description: string };
export const SHAPES: Record<Shape, ShapeDef> = {
  column: { label: 'Column', description: 'Tall vertical stack (full width).' },
  sidebar: { label: 'Sidebar', description: 'Skinny vertical column; blocks shrink to fit.' },
  row: { label: 'Row', description: 'Horizontal band of blocks.' },
  grid: { label: 'Grid', description: 'Auto-flowing responsive grid.' },
  card: { label: 'Card', description: 'A single framed block.' },
};
export const SHAPE_IDS = Object.keys(SHAPES) as Shape[];
export function isShape(v: unknown): v is Shape {
  return typeof v === 'string' && v in SHAPES;
}

/* --------------------------------- Blocks -------------------------------- */

export type BlockType =
  | 'article' | 'article-image' | 'article-headline'
  | 'ad' | 'poll' | 'quiz' | 'heading' | 'text' | 'image';

// Palette groups — let the builder collapse whole categories of blocks.
export type BlockGroup = 'Articles' | 'Media' | 'Interactive' | 'Content';

export type BlockDef = {
  label: string;
  description: string;
  group: BlockGroup;
  // Default settings applied when a fresh block of this type is created.
  defaults: BlockSettings;
};

export const BLOCKS: Record<BlockType, BlockDef> = {
  article: {
    label: 'Article', group: 'Articles',
    description: 'Headline + dek, no image.',
    defaults: { mode: 'auto', source: 'latest', showDek: true },
  },
  'article-image': {
    label: 'Article + image', group: 'Articles',
    description: 'Headline + dek with image.',
    defaults: { mode: 'auto', source: 'latest', showDek: true, imagePosition: 'top' },
  },
  'article-headline': {
    label: 'Article headline', group: 'Articles',
    description: 'Headline only — fills the row and shrinks to fit.',
    defaults: { mode: 'auto', source: 'latest' },
  },
  ad: {
    label: 'Ad', group: 'Media',
    description: 'Ad slot — auto-fits the container.',
    defaults: { format: 'rectangle', vendor: '' },
  },
  image: {
    label: 'Image', group: 'Media',
    description: 'A picture with manual resize.',
    defaults: { url: '', alt: '', widthPct: 100, radius: true },
  },
  poll: {
    label: 'Poll', group: 'Interactive',
    description: 'Pick a reader poll to show.',
    defaults: { pollId: '', chart: 'bar' },
  },
  quiz: {
    label: 'Quiz', group: 'Interactive',
    description: 'Pick a Pop Quiz to show.',
    defaults: { quizId: '', timerHours: 0 },
  },
  heading: {
    label: 'Heading', group: 'Content',
    description: 'A section title.',
    defaults: { text: 'Section title', level: 2 },
  },
  text: {
    label: 'Text', group: 'Content',
    description: 'Freeform rich text.',
    defaults: { body: '' },
  },
};
export const BLOCK_IDS = Object.keys(BLOCKS) as BlockType[];
export const BLOCK_GROUPS: BlockGroup[] = ['Articles', 'Media', 'Interactive', 'Content'];
export function blocksInGroup(group: BlockGroup): BlockType[] {
  return BLOCK_IDS.filter((t) => BLOCKS[t].group === group);
}
export function isBlockType(v: unknown): v is BlockType {
  return typeof v === 'string' && v in BLOCKS;
}
export function blockLabel(type: BlockType): string {
  return BLOCKS[type]?.label ?? type;
}

/* --------------------------------- Tree ---------------------------------- */

export type BlockSettings = Record<string, unknown>;

export type Block = {
  id: string;
  type: BlockType;
  // RS-Mode-ONLY background (hex OR a texture key, see RS_TEXTURES). Ignored in
  // Light/Dark. null = theme default.
  rsColor?: string | null;
  // Optional small uppercase eyebrow shown above the element.
  label?: string;
  settings: BlockSettings;
  // Optional schedule window (ISO 8601). The element only shows while now is
  // within [startAt, endAt] (either end open). Outside the window it counts as
  // "unavailable" and the slot falls through to the next rung — so scheduling A
  // to take over a slot for a week, then hand it back to B, is just: A on top
  // with a window, B as its fallback.
  startAt?: string | null;
  endAt?: string | null;
  // Audience gate. When set (a requirement token like 'premium' | 'member' |
  // 'packagehub' | 'vendor' | 'staff', or '' = everyone), viewers who don't meet
  // it either see a locked teaser (gateMode 'tease', the default — good for
  // conversion) or don't see it at all (gateMode 'swap' → the slot falls through
  // to the next rung, exactly like a schedule/availability miss). See
  // lib/entitlements.canViewContent.
  requirement?: string;
  gateMode?: 'tease' | 'swap';
  // Priority stack: if this element has no content to show right now (a poll
  // that isn't running, a hand-picked article that's unpublished, an empty
  // image…), the renderer falls through to these in order and shows the first
  // one that CAN fill. A generic type at the bottom (e.g. an ad, or an
  // auto/latest article) makes the slot un-emptiable, so the module never
  // collapses or resizes — content is only ever replaced, never removed.
  // Fallbacks are plain blocks; their own `fallbacks` are ignored (one level).
  fallbacks?: Block[];
};

export type ModuleTree = {
  shape: Shape;
  // RS-Mode-only container background override.
  rsColor?: string | null;
  // Optional invisible expiry (days). 0 = never. Anchored at publish time.
  expireDays?: number;
  children: Block[];
};

// Hard caps so a malformed/hostile payload can't blow up the renderer or DB.
export const MAX_BLOCKS = 40;
export const MAX_FALLBACKS = 4;
const MAX_OPTIONS = 12;

// The full priority stack for a slot: the block itself, then its fallbacks in
// order. The renderer/preview walk this and use the first rung that can fill.
export function blockChain(b: Block): Block[] {
  return b.fallbacks && b.fallbacks.length ? [b, ...b.fallbacks] : [b];
}

/* ------------------------------ Validation ------------------------------- */

// Accepts #rgb / #rrggbb (case-insensitive). Everything else is rejected so a
// stray value can never land in an inline style attribute.
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

// The RS-Mode palette shown in the Studio's Theme picker. Backgrounds may be a
// solid color OR one of these textures (referenced by `key`, e.g. "tex:orange").
export type RsTexture = { key: string; label: string; url: string };
export const RS_TEXTURES: RsTexture[] = [
  { key: 'tex:orange', label: 'Corrugated orange', url: '/textures/rs-orange.webp' },
  { key: 'tex:cream', label: 'Cream stamps', url: '/textures/rs-cream.webp' },
];
export type RsSolid = { value: string; label: string };
export const RS_SOLIDS: RsSolid[] = [
  { value: '#E97D34', label: 'Brand orange' },
  { value: '#3d2a19', label: 'Brown' },
  { value: '#f7edd8', label: 'Cream' },
  { value: '#2b333c', label: 'Ink' },
  { value: '#7a5a3a', label: 'Kraft' },
  { value: '#b23b2e', label: 'Barn red' },
];
export function isRsTexture(v: unknown): v is string {
  return typeof v === 'string' && RS_TEXTURES.some((t) => t.key === v);
}
export function rsTextureUrl(v: string): string | null {
  return RS_TEXTURES.find((t) => t.key === v)?.url ?? null;
}
// A valid RS background is a hex color OR a known texture key.
export function isRsColor(v: unknown): v is string {
  return isHexColor(v) || isRsTexture(v);
}
function color(v: unknown): string | null {
  return isRsColor(v) ? (v as string) : null;
}

// Create a fresh block of a type with its default settings.
export function makeBlock(type: BlockType, id: string): Block {
  return { id, type, rsColor: null, settings: { ...BLOCKS[type].defaults } };
}

// A brand-new, empty module of the given shape.
export function emptyTree(shape: Shape = 'column'): ModuleTree {
  return { shape: isShape(shape) ? shape : 'column', rsColor: null, children: [] };
}

// Coerce arbitrary parsed JSON into a safe ModuleTree: valid shape, known block
// types only, sanitized settings, validated colors, capped counts, stable ids.
// Never throws — bad input degrades to an empty/normalized tree.
export function normalizeTree(input: unknown): ModuleTree {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const shape: Shape = isShape(obj.shape) ? obj.shape : 'column';
  const rawChildren = Array.isArray(obj.children) ? obj.children : [];
  const children: Block[] = [];
  for (let i = 0; i < rawChildren.length && children.length < MAX_BLOCKS; i++) {
    const b = normalizeBlock(rawChildren[i], i);
    if (b) children.push(b);
  }
  const days = Number(obj.expireDays);
  const expireDays = Number.isInteger(days) && days > 0 ? Math.min(days, 3650) : 0;
  return { shape, rsColor: color(obj.rsColor), expireDays, children };
}

function normalizeBlock(input: unknown, index: number, allowFallbacks = true): Block | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (!isBlockType(o.type)) return null;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 64) : `b${index}`;
  const settings = normalizeSettings(o.type, o.settings);
  const label = str(o.label, 60).trim();
  const startAt = isoOrNull(o.startAt);
  const endAt = isoOrNull(o.endAt);
  // Audience gate: a short lowercase token; '' / absent = everyone. gateMode
  // only matters when a requirement is set.
  const requirement = str(o.requirement, 40).trim().toLowerCase();
  const gateMode: 'tease' | 'swap' = o.gateMode === 'swap' ? 'swap' : 'tease';
  // Fallbacks are a single level deep — a fallback's own `fallbacks` are dropped
  // so a slot can never fan out into an unbounded tree.
  let fallbacks: Block[] | undefined;
  if (allowFallbacks && Array.isArray(o.fallbacks)) {
    const fb: Block[] = [];
    for (let i = 0; i < o.fallbacks.length && fb.length < MAX_FALLBACKS; i++) {
      const f = normalizeBlock(o.fallbacks[i], i, false);
      if (f) fb.push(f);
    }
    if (fb.length) fallbacks = fb;
  }
  return {
    id, type: o.type, rsColor: color(o.rsColor), ...(label ? { label } : {}),
    ...(startAt ? { startAt } : {}), ...(endAt ? { endAt } : {}),
    ...(requirement ? { requirement, gateMode } : {}),
    settings, ...(fallbacks ? { fallbacks } : {}),
  };
}

// Is this block within its schedule window at time `now` (ms)? Blocks with no
// window are always in-window. A start/end that's set gates the respective side.
export function inSchedule(b: Block, now: number): boolean {
  if (b.startAt && Date.parse(b.startAt) > now) return false;
  if (b.endAt && Date.parse(b.endAt) < now) return false;
  return true;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
// Canonicalize a schedule bound to an ISO string, or null. Anything unparseable
// is dropped so a bad value can never gate (or fail to gate) a slot by accident.
function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
function bool(v: unknown, dflt: boolean): boolean {
  return typeof v === 'boolean' ? v : dflt;
}

// Per-type settings whitelist — only known keys survive, so the DB never stores
// (and the renderer never reads) arbitrary attacker-controlled fields.
function normalizeSettings(type: BlockType, input: unknown): BlockSettings {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const d = BLOCKS[type].defaults;
  switch (type) {
    case 'article':
      return { ...articleFill(s), showDek: bool(s.showDek, true) };
    case 'article-image':
      return {
        ...articleFill(s),
        showDek: bool(s.showDek, true),
        imagePosition: s.imagePosition === 'left' || s.imagePosition === 'top' ? s.imagePosition : 'top',
      };
    case 'article-headline':
      return { ...articleFill(s) };
    case 'ad': {
      const ok = ['leaderboard', 'video', 'vertical', 'square', 'rectangle'];
      // `vendor` (an advertiser/brand key) locks the slot to that advertiser's
      // creatives only — a sponsor spotlight. '' = any advertiser.
      return { format: ok.includes(String(s.format)) ? String(s.format) : 'rectangle', vendor: str(s.vendor, 80).trim() };
    }
    case 'image': {
      const w = Number(s.widthPct);
      return {
        url: str(s.url, 2000),
        alt: str(s.alt, 300),
        // Manual resize: 10%–200% of the container (>100% intentionally overflows).
        widthPct: Number.isFinite(w) ? Math.min(Math.max(Math.round(w), 10), 200) : 100,
        radius: bool(s.radius, true),
      };
    }
    case 'quiz': {
      const hours = Number(s.timerHours);
      return {
        quizId: str(s.quizId, 40),
        timerHours: Number.isFinite(hours) && hours > 0 ? Math.min(Math.round(hours), 24 * 365) : 0,
      };
    }
    case 'poll':
      // Poll elements pick a poll from the Polls library (built + timed there),
      // just like the Quiz element picks a quiz.
      return { pollId: str(s.pollId, 40), chart: s.chart === 'pie' ? 'pie' : 'bar' };
    case 'heading': {
      const level = Number(s.level);
      return { text: str(s.text, 120) || 'Section title', level: level === 2 || level === 3 ? level : 2 };
    }
    case 'text':
      return { body: str(s.body, 4000) };
    default:
      return { ...d };
  }
}

const ARTICLE_SOURCE_VALUES = ['featured', 'latest', 'trending'] as const;
function articleSource(v: unknown): string {
  return typeof v === 'string' && (ARTICLE_SOURCE_VALUES as readonly string[]).includes(v) ? v : 'latest';
}

// How an article block chooses its story:
//   auto → a pool (featured/latest/trending), de-duped within the module
//   tag  → auto-fill from articles carrying a tag/keyword
//   year → auto-fill from a given year (throwbacks)
//   pick → a specific hand-picked article
export type ArticleMode = 'auto' | 'tag' | 'year' | 'pick';
function articleFill(s: Record<string, unknown>): BlockSettings {
  const mode: ArticleMode = s.mode === 'tag' || s.mode === 'year' || s.mode === 'pick' ? s.mode : 'auto';
  if (mode === 'tag') return { mode, tag: str(s.tag, 60), source: articleSource(s.source) };
  if (mode === 'year') {
    const y = Number(s.year);
    return { mode, year: Number.isInteger(y) && y >= 1990 && y <= 2100 ? y : 0, source: articleSource(s.source) };
  }
  if (mode === 'pick') return { mode, articleId: str(s.articleId, 40) };
  return { mode: 'auto', source: articleSource(s.source) };
}

/* ----------------------------- Serialization ----------------------------- */

export function serializeTree(tree: ModuleTree): string {
  return JSON.stringify(normalizeTree(tree));
}
export function parseTree(json: string | null | undefined): ModuleTree {
  if (!json) return emptyTree();
  try {
    return normalizeTree(JSON.parse(json));
  } catch {
    return emptyTree();
  }
}

// Custom modules are referenced in the homepage layout by a namespaced id so
// they coexist with the fixed catalog modules without id collisions.
export const CUSTOM_PREFIX = 'custom:';
export function customModuleId(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
}
export function isCustomModuleId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}
export function customIdOf(layoutId: string): string | null {
  return isCustomModuleId(layoutId) ? layoutId.slice(CUSTOM_PREFIX.length) : null;
}
