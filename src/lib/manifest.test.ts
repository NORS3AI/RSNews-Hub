import { describe, it, expect } from 'vitest';
import { categoryManifest } from './manifest';
import type { CategoryPageData } from './categoryData';

// Minimal card + bundle factories (only the fields the manifest reads).
const card = (over: Partial<any> = {}) => ({
  id: 'a1', title: 'Title', slug: 'title', excerpt: null, coverImage: null,
  category: null, sponsored: false, genre: '', ...over,
});
const bundle = (articles: any[], description: string | null = null): CategoryPageData => ({
  category: { id: 'c1', name: 'What’s Hot', slug: 'whats-hot', color: '#e97d34', description } as any,
  articles: articles as any,
});

describe('categoryManifest', () => {
  it('is fully JSON-serializable (no Maps, class instances, or functions)', () => {
    const m = categoryManifest(bundle([card()]));
    const roundTripped = JSON.parse(JSON.stringify(m));
    expect(roundTripped).toEqual(m);
  });

  it('emits heading + description + one card block per article', () => {
    const m = categoryManifest(bundle([card({ id: 'x', title: 'Hello', slug: 'hello' })], 'A section.'));
    expect(m.surface).toBe('category');
    expect(m.blocks[0]).toMatchObject({ type: 'heading', level: 1, text: 'What’s Hot' });
    expect(m.blocks[1]).toMatchObject({ type: 'text', text: 'A section.' });
    expect(m.blocks.filter((b) => b.type === 'article-card')).toHaveLength(1);
  });

  it('carries the Partner-content disclosure straight from the shared rule', () => {
    // sponsored card → partner:true; plain card → partner:false. Same rule the
    // React cards use (isPartnerContent), so a manifest UI discloses identically.
    const m = categoryManifest(bundle([card({ id: 's', sponsored: true }), card({ id: 'n' })]));
    const cards = m.blocks.filter((b) => b.type === 'article-card') as Extract<typeof m.blocks[number], { type: 'article-card' }>[];
    expect(cards.find((c) => c.id === 's')!.partner).toBe(true);
    expect(cards.find((c) => c.id === 'n')!.partner).toBe(false);
  });

  it('shows an empty block (not a card list) when the category has no articles', () => {
    const m = categoryManifest(bundle([]));
    expect(m.blocks.some((b) => b.type === 'empty')).toBe(true);
    expect(m.blocks.some((b) => b.type === 'article-card')).toBe(false);
  });

  it('never leaks the raw vendor id into the manifest', () => {
    const json = JSON.stringify(categoryManifest(bundle([card({ sponsored: true })])));
    expect(json).not.toMatch(/sponsorVendorId/);
  });
});
