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
    defaults: { format: 'rectangle' },
  },
  image: {
    label: 'Image', group: 'Media',
    description: 'A picture with manual resize.',
    defaults: { url: '', alt: '', widthPct: 100, radius: true },
  },
  poll: {
    label: 'Poll', group: 'Interactive',
    description: 'Live reader poll with an optional timer.',
    defaults: { question: '', options: ['', ''], timerHours: 72, chart: 'bar' },
  },
  quiz: {
    label: 'Quiz', group: 'Interactive',
    description: 'Shows the current Pop Quiz.',
    defaults: {},
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
  // RS-Mode-ONLY color override (hex). Ignored in Light/Dark. null = theme default.
  rsColor?: string | null;
  settings: BlockSettings;
};

export type ModuleTree = {
  shape: Shape;
  // RS-Mode-only container background override.
  rsColor?: string | null;
  children: Block[];
};

// Hard caps so a malformed/hostile payload can't blow up the renderer or DB.
export const MAX_BLOCKS = 40;
const MAX_OPTIONS = 12;

/* ------------------------------ Validation ------------------------------- */

// Accepts #rgb / #rrggbb (case-insensitive). Everything else is rejected so a
// stray value can never land in an inline style attribute.
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}
function color(v: unknown): string | null {
  return isHexColor(v) ? v : null;
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
  return { shape, rsColor: color(obj.rsColor), children };
}

function normalizeBlock(input: unknown, index: number): Block | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (!isBlockType(o.type)) return null;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 64) : `b${index}`;
  const settings = normalizeSettings(o.type, o.settings);
  return { id, type: o.type, rsColor: color(o.rsColor), settings };
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
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
      const format = s.format === 'leaderboard' || s.format === 'video' ? s.format : 'rectangle';
      return { format };
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
    case 'quiz':
      return {};
    case 'poll': {
      const options = (Array.isArray(s.options) ? s.options : [])
        .map((o) => str(o, 120))
        .slice(0, MAX_OPTIONS);
      while (options.length < 2) options.push('');
      const hours = Number(s.timerHours);
      const out: BlockSettings = {
        question: str(s.question, 200),
        options,
        timerHours: Number.isFinite(hours) && hours > 0 ? Math.min(Math.round(hours), 24 * 365) : 72,
        chart: s.chart === 'pie' ? 'pie' : 'bar',
      };
      // Link to the materialized Poll record (set once the module is published).
      if (typeof s.pollId === 'string' && s.pollId) out.pollId = s.pollId.slice(0, 64);
      return out;
    }
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
