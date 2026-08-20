import { describe, it, expect } from 'vitest';
import {
  normalizeTree, emptyTree, makeBlock, serializeTree, parseTree, isHexColor,
  MAX_BLOCKS, MAX_FALLBACKS, blockChain, inSchedule, customModuleId, isCustomModuleId, customIdOf,
  BLOCK_IDS, ARTICLE_SOURCED_BLOCKS, isArticleSourced,
  normalizeCollection, collectionKey, collectionOffset, rotatePool, collectionStep,
} from './studio';

describe('studio tree model', () => {
  it('emptyTree defaults to a column with no children', () => {
    const t = emptyTree();
    expect(t.shape).toBe('column');
    expect(t.children).toEqual([]);
    expect(t.rsColor).toBeNull();
  });

  it('emptyTree falls back to column for an unknown shape', () => {
    expect(emptyTree('spiral' as any).shape).toBe('column');
  });

  it('makeBlock seeds default settings per type', () => {
    expect(makeBlock('article', 'x').settings).toEqual({ mode: 'auto', source: 'latest', showDek: true });
    expect(makeBlock('poll', 'p').settings).toEqual({ pollId: '', chart: 'bar' });
  });

  it('normalizes article sourcing modes (auto/tag/year/pick)', () => {
    const t = normalizeTree({ children: [
      { type: 'article', settings: { mode: 'tag', tag: 'Logistics', showDek: false } },
      { type: 'article-headline', settings: { mode: 'year', year: 2019 } },
      { type: 'article-image', settings: { mode: 'pick', articleId: 'abc123' } },
      { type: 'article', settings: { mode: 'year', year: 3000 } }, // out of range → 0
    ] });
    expect(t.children[0].settings).toMatchObject({ mode: 'tag', tag: 'Logistics', showDek: false });
    expect(t.children[1].settings).toMatchObject({ mode: 'year', year: 2019 });
    expect(t.children[2].settings).toMatchObject({ mode: 'pick', articleId: 'abc123' });
    expect(t.children[3].settings.year).toBe(0);
  });

  it('normalizeTree drops unknown block types and keeps valid ones', () => {
    const t = normalizeTree({
      shape: 'row',
      children: [
        { type: 'article', id: 'a', settings: { source: 'trending' } },
        { type: 'bogus', id: 'z' },
        { type: 'ad', id: 'ad1' },
      ],
    });
    expect(t.shape).toBe('row');
    expect(t.children.map((c) => c.type)).toEqual(['article', 'ad']);
    expect(t.children[0].settings.source).toBe('trending');
  });

  it('synthesizes ids for blocks missing them', () => {
    const t = normalizeTree({ children: [{ type: 'ad' }, { type: 'ad' }] });
    expect(t.children[0].id).toBe('b0');
    expect(t.children[1].id).toBe('b1');
  });

  it('only accepts valid hex colors for rsColor', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#E97D34')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#12')).toBe(false);
    const t = normalizeTree({ rsColor: 'javascript:alert(1)', children: [{ type: 'ad', rsColor: '#abc' }] });
    expect(t.rsColor).toBeNull();
    expect(t.children[0].rsColor).toBe('#abc');
  });

  it('caps children at MAX_BLOCKS', () => {
    const many = Array.from({ length: MAX_BLOCKS + 10 }, () => ({ type: 'ad' }));
    expect(normalizeTree({ children: many }).children.length).toBe(MAX_BLOCKS);
  });

  it('poll block keeps pollId + chart (library picker model)', () => {
    const t = normalizeTree({ children: [{ type: 'poll', settings: { pollId: 'p1', chart: 'pie', junk: 1 } }] });
    expect(t.children[0].settings).toEqual({ pollId: 'p1', chart: 'pie' });
  });

  it('normalizes module expiry days (clamped, 0 default)', () => {
    expect(normalizeTree({ expireDays: 7 }).expireDays).toBe(7);
    expect(normalizeTree({ expireDays: -3 }).expireDays).toBe(0);
    expect(normalizeTree({}).expireDays).toBe(0);
  });

  it('normalizes the holiday effect + confetti colors', () => {
    expect(normalizeTree({}).effect).toBe(null);
    expect(normalizeTree({ effect: 'snow' }).effect).toBe('snow');
    expect(normalizeTree({ effect: 'confetti' }).effect).toBe('confetti');
    expect(normalizeTree({ effect: 'fireworks' }).effect).toBe(null); // unknown → off
    // colors: only valid hex, capped at 3
    const t = normalizeTree({ effect: 'confetti', effectColors: ['#E97D34', 'red', '#fff', '#000', '#123456'] });
    expect(t.effectColors).toEqual(['#E97D34', '#fff', '#000']);
  });

  it('normalizes a module article collection', () => {
    expect(normalizeTree({}).collection).toBe(null);
    // no category → the whole collection is off
    expect(normalizeCollection({ tags: ['x'] })).toBe(null);
    const c = normalizeCollection({
      categorySlug: 'Blogs', tags: ['A', ' ', 'b', 'a', 'c', 'd', 'e', 'f', 'g'],
      year: 2022, sort: 'recommended', rotateHours: 24,
    });
    expect(c).toEqual({ categorySlug: 'blogs', tags: ['a', 'b', 'c', 'd', 'e', 'f'], year: 2022, sort: 'recommended', rotateHours: 24 });
    // invalid sort/year/rotate fall back to safe defaults
    const d = normalizeCollection({ categorySlug: 'news', sort: 'bogus', year: 1200, rotateHours: 7 });
    expect(d).toEqual({ categorySlug: 'news', tags: [], year: 0, sort: 'newest', rotateHours: 0 });
    // survives a serialize/parse round-trip on the tree
    const t = parseTree(serializeTree(normalizeTree({ collection: { categorySlug: 'blogs', sort: 'views' } })));
    expect(t.collection?.categorySlug).toBe('blogs');
    expect(t.collection?.sort).toBe('views');
  });

  it('collectionStep counts how many stories a module draws from its collection', () => {
    const t = (children: unknown[]) => collectionStep(children as never);
    const art = (mode?: string) => ({ id: 'x', type: 'article-image', settings: mode ? { mode } : {}, children: [] });
    const mosaic = (count: number) => ({ id: 'm', type: 'mosaic', settings: { count }, children: [] });
    // three single-article slots → 3
    expect(t([art(), art(), art()])).toBe(3);
    // a hand-pick consumes nothing from the pool
    expect(t([art(), art('pick'), art()])).toBe(2);
    // a mosaic consumes its whole tile count (clamped 3–6), not 1
    expect(t([mosaic(6)])).toBe(6);
    expect(t([mosaic(99)])).toBe(6);
    expect(t([mosaic(1)])).toBe(3);
    expect(t([art(), mosaic(4)])).toBe(5);
    // non-article blocks don't count; floor is 1
    expect(t([{ id: 'h', type: 'heading', settings: {}, children: [] }])).toBe(1);
  });

  it('collectionKey is stable regardless of tag order', () => {
    const a = collectionKey({ categorySlug: 'blogs', tags: ['x', 'y'], year: 0, sort: 'newest', rotateHours: 0 });
    const b = collectionKey({ categorySlug: 'blogs', tags: ['y', 'x'], year: 0, sort: 'newest', rotateHours: 0 });
    expect(a).toBe(b);
    // a different filter yields a different key
    expect(collectionKey({ categorySlug: 'blogs', tags: [], year: 2022, sort: 'newest', rotateHours: 0 })).not.toBe(a);
  });

  it('collectionOffset rotates deterministically by the clock', () => {
    const hourMs = 3_600_000;
    // off → always 0
    expect(collectionOffset(0, 10, 3, 999 * hourMs)).toBe(0);
    // daily rotation, step 3, pool 10: bucket = floor(hours/24)
    expect(collectionOffset(24, 10, 3, 0)).toBe(0);          // bucket 0
    expect(collectionOffset(24, 10, 3, 24 * hourMs)).toBe(3); // bucket 1 → 3
    expect(collectionOffset(24, 10, 3, 48 * hourMs)).toBe(6); // bucket 2 → 6
    expect(collectionOffset(24, 10, 3, 72 * hourMs)).toBe(9); // bucket 3 → 9
    expect(collectionOffset(24, 10, 3, 96 * hourMs)).toBe(2); // bucket 4 → 12 % 10
    // guards
    expect(collectionOffset(24, 0, 3, 24 * hourMs)).toBe(0);
  });

  it('rotatePool wraps the pool without dropping items', () => {
    expect(rotatePool([1, 2, 3, 4], 0)).toEqual([1, 2, 3, 4]);
    expect(rotatePool([1, 2, 3, 4], 1)).toEqual([2, 3, 4, 1]);
    expect(rotatePool([1, 2, 3, 4], 4)).toEqual([1, 2, 3, 4]); // full turn
    expect(rotatePool([1, 2, 3, 4], 6)).toEqual([3, 4, 1, 2]); // wraps
    expect(rotatePool([], 3)).toEqual([]);
  });

  it('whitelists settings keys — unknown fields are stripped', () => {
    const t = normalizeTree({ children: [{ type: 'ad', settings: { format: 'leaderboard', evil: '<script>' } }] });
    expect(t.children[0].settings).toEqual({ format: 'leaderboard', vendor: '' });
  });

  it('normalizes new block types (image clamps width, ad format falls back)', () => {
    const t = normalizeTree({ children: [
      { type: 'image', settings: { url: 'https://x/y.png', widthPct: 500, alt: 'hi' } },
      { type: 'ad', settings: { format: 'bogus' } },
      { type: 'article-headline', settings: { source: 'trending' } },
    ] });
    expect(t.children[0].settings).toMatchObject({ url: 'https://x/y.png', widthPct: 200, alt: 'hi' }); // clamped to 200
    expect(t.children[1].settings).toEqual({ format: 'rectangle', vendor: '' }); // unknown → default
    expect(t.children[2].settings).toEqual({ mode: 'auto', source: 'trending' });
  });

  it('ad formats: keeps the four real shapes; retired square → rectangle', () => {
    const fmt = (f: string) => (normalizeTree({ children: [{ type: 'ad', settings: { format: f } }] }).children[0].settings as { format: string }).format;
    expect(fmt('leaderboard')).toBe('leaderboard');
    expect(fmt('rectangle')).toBe('rectangle');
    expect(fmt('video')).toBe('video');
    expect(fmt('vertical')).toBe('vertical');   // the skyscraper
    expect(fmt('square')).toBe('rectangle');    // retired → collapses to rectangle
  });

  it('video block preserves its settings on normalize (no data loss)', () => {
    const t = normalizeTree({ children: [
      { type: 'video', settings: { url: 'https://x/y.mp4', poster: 'https://x/p.png', widthPct: 500, radius: false } },
    ] });
    expect(t.children[0].settings).toMatchObject({ url: 'https://x/y.mp4', poster: 'https://x/p.png', widthPct: 200, radius: false });
  });

  it('countdown href only allows safe schemes (blocks javascript:/data:)', () => {
    const mk = (href: string) => (normalizeTree({ children: [{ type: 'countdown', settings: { targetAt: '2030-01-01T00:00:00.000Z', href } }] }).children[0].settings as { href: string }).href;
    expect(mk('javascript:alert(document.cookie)')).toBe(''); // stripped
    expect(mk('data:text/html,<script>1</script>')).toBe(''); // stripped
    expect(mk('//evil.com')).toBe('');                        // protocol-relative stripped
    expect(mk('https://example.com/sale')).toBe('https://example.com/sale'); // kept
    expect(mk('/docs/category/deals')).toBe('/docs/category/deals');         // relative kept
    expect(mk('mailto:sales@x.com')).toBe('mailto:sales@x.com');             // kept
  });

  it('round-trips through serialize/parse', () => {
    const t = normalizeTree({ shape: 'grid', children: [makeBlock('heading', 'h'), makeBlock('text', 't')] });
    expect(parseTree(serializeTree(t))).toEqual(t);
  });

  it('parseTree degrades bad JSON to an empty tree', () => {
    expect(parseTree('not json{')).toEqual(emptyTree());
    expect(parseTree(null)).toEqual(emptyTree());
  });

  it('normalizes a fallback chain: one level deep, capped, bad rungs dropped', () => {
    const t = normalizeTree({ children: [
      { type: 'poll', settings: { pollId: 'p1' }, fallbacks: [
        { type: 'ad', settings: { format: 'leaderboard' } },
        { type: 'bogus', settings: {} },                                   // dropped (unknown type)
        { type: 'article-headline', settings: { source: 'latest' },
          fallbacks: [{ type: 'ad', settings: {} }] },                      // nested fallback stripped
        { type: 'ad', settings: {} }, { type: 'ad', settings: {} }, { type: 'ad', settings: {} }, // overflow past cap
      ] },
    ] });
    const slot = t.children[0];
    expect(slot.type).toBe('poll');
    expect(slot.fallbacks!.length).toBeLessThanOrEqual(MAX_FALLBACKS);
    expect(slot.fallbacks![0].settings).toEqual({ format: 'leaderboard', vendor: '' });
    expect(slot.fallbacks![1].type).toBe('article-headline');             // bogus was dropped
    expect(slot.fallbacks![1].fallbacks).toBeUndefined();                 // no nesting
    expect(blockChain(slot)[0]).toBe(slot);                                // chain = primary + fallbacks
    expect(blockChain(slot).length).toBe(1 + slot.fallbacks!.length);
  });

  it('a block with no fallbacks has a chain of just itself', () => {
    const b = makeBlock('ad', 'a');
    expect(b.fallbacks).toBeUndefined();
    expect(blockChain(b)).toEqual([b]);
  });

  it('normalizes schedule bounds to ISO or drops them', () => {
    const t = normalizeTree({ children: [
      { type: 'ad', settings: {}, startAt: '2026-08-20T19:00:00.000Z', endAt: 'not-a-date' },
    ] });
    expect(t.children[0].startAt).toBe('2026-08-20T19:00:00.000Z');
    expect(t.children[0].endAt).toBeUndefined(); // unparseable → dropped
  });

  it('inSchedule gates by window (open-ended sides allowed)', () => {
    const now = Date.parse('2026-08-22T12:00:00Z');
    const within = { ...makeBlock('ad', 'a'), startAt: '2026-08-20T00:00:00Z', endAt: '2026-08-25T00:00:00Z' };
    const future = { ...makeBlock('ad', 'b'), startAt: '2026-08-30T00:00:00Z' };
    const past = { ...makeBlock('ad', 'c'), endAt: '2026-08-21T00:00:00Z' };
    expect(inSchedule(within, now)).toBe(true);
    expect(inSchedule(future, now)).toBe(false);   // hasn't started
    expect(inSchedule(past, now)).toBe(false);      // already ended
    expect(inSchedule(makeBlock('ad', 'd'), now)).toBe(true); // no window = always on
  });

  it('normalizes an audience gate (requirement + mode); default mode is tease', () => {
    const t = normalizeTree({ children: [
      { type: 'poll', settings: { pollId: 'p' }, requirement: 'PackageHub', gateMode: 'swap' },
      { type: 'ad', settings: {}, requirement: 'premium' },              // mode defaults to tease
      { type: 'text', settings: { body: 'hi' }, gateMode: 'swap' },      // no requirement → gate dropped
    ] });
    expect(t.children[0].requirement).toBe('packagehub');
    expect(t.children[0].gateMode).toBe('swap');
    expect(t.children[1].requirement).toBe('premium');
    expect(t.children[1].gateMode).toBe('tease');
    expect(t.children[2].requirement).toBeUndefined();
    expect(t.children[2].gateMode).toBeUndefined();
  });

  it('namespaces custom module ids', () => {
    expect(customModuleId('abc')).toBe('custom:abc');
    expect(isCustomModuleId('custom:abc')).toBe(true);
    expect(isCustomModuleId('latest')).toBe(false);
    expect(customIdOf('custom:abc')).toBe('abc');
    expect(customIdOf('latest')).toBeNull();
  });

  // Drift guard: the homepage prefetch and the admin inventory both rely on
  // isArticleSourced() to decide which blocks need pick/tag/year/category pools.
  // If someone adds a new article-driven element and forgets to classify it, it
  // would render blank live (the exact bug the audit caught) — this test forces
  // the decision by pinning the set and asserting every entry is a real block.
  it('isArticleSourced covers exactly the sourcing-driven blocks', () => {
    expect([...ARTICLE_SOURCED_BLOCKS].sort()).toEqual(
      ['article', 'article-headline', 'article-image', 'spotlight', 'split'].sort(),
    );
    for (const t of ARTICLE_SOURCED_BLOCKS) expect(BLOCK_IDS).toContain(t);
    expect(isArticleSourced('spotlight')).toBe(true);
    expect(isArticleSourced('split')).toBe(true);
    // mosaic shows articles but is source-only (no pick/tag/year) → not "sourced".
    expect(isArticleSourced('mosaic')).toBe(false);
    expect(isArticleSourced('ad')).toBe(false);
    expect(isArticleSourced('poll')).toBe(false);
  });
});
