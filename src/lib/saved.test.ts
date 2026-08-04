import { describe, it, expect } from 'vitest';
import { normalizeSavedItem, normalizeClipping } from './saved';

describe('normalizeSavedItem', () => {
  it('accepts a valid item and defaults a missing title', () => {
    expect(normalizeSavedItem({ id: 'a1', title: 'Hello', slug: 'hello' })).toEqual({ id: 'a1', title: 'Hello', slug: 'hello' });
    expect(normalizeSavedItem({ id: 'a1' })).toEqual({ id: 'a1', title: 'Untitled', slug: '' });
  });
  it('rejects items without an id', () => {
    expect(normalizeSavedItem({ title: 'x' })).toBeNull();
    expect(normalizeSavedItem({ id: '  ' })).toBeNull();
    expect(normalizeSavedItem(null)).toBeNull();
    expect(normalizeSavedItem('nope')).toBeNull();
  });
  it('clamps overly long fields', () => {
    const r = normalizeSavedItem({ id: 'x'.repeat(200), title: 'y'.repeat(1000), slug: 'z'.repeat(1000) })!;
    expect(r.id.length).toBe(64);
    expect(r.title.length).toBe(300);
    expect(r.slug.length).toBe(300);
  });
});

describe('normalizeClipping', () => {
  it('normalizes a quote clipping', () => {
    const c = normalizeClipping({ id: 'c1', ts: 123, title: 'T', kind: 'quote', quote: 'hi', author: 'A', slug: 's' })!;
    expect(c).toMatchObject({ id: 'c1', ts: 123, title: 'T', kind: 'quote', quote: 'hi', author: 'A', slug: 's' });
  });
  it('defaults kind to quote and supports comic', () => {
    expect(normalizeClipping({ id: 'c1' })!.kind).toBe('quote');
    expect(normalizeClipping({ id: 'c2', kind: 'comic', image: 'data:...' })!.kind).toBe('comic');
    expect(normalizeClipping({ id: 'c3', kind: 'weird' })!.kind).toBe('quote'); // unknown → quote
  });
  it('requires an id and stamps ts when missing/invalid', () => {
    expect(normalizeClipping({ title: 'x' })).toBeNull();
    const c = normalizeClipping({ id: 'c9', ts: NaN })!;
    expect(typeof c.ts).toBe('number');
    expect(c.ts).toBeGreaterThan(0);
  });
  it('nulls empty author/slug', () => {
    const c = normalizeClipping({ id: 'c1', author: '', slug: '' })!;
    expect(c.author).toBeNull();
    expect(c.slug).toBeUndefined();
  });
});
