import { describe, it, expect } from 'vitest';
import { classifyShape, pairCreatives } from './adSizes';

describe('classifyShape', () => {
  it('routes wide/letterbox creatives to the banner slot', () => {
    expect(classifyShape(728, 90)).toBe('wide');   // leaderboard
    expect(classifyShape(970, 250)).toBe('wide');  // billboard
    expect(classifyShape(300, 50)).toBe('wide');   // mobile banner
  });
  it('routes tall/portrait creatives to the skyscraper slot', () => {
    expect(classifyShape(160, 600)).toBe('tall');  // skyscraper (0.27)
    expect(classifyShape(300, 600)).toBe('tall');  // half-page (0.50)
    expect(classifyShape(120, 600)).toBe('tall');  // wide skyscraper (0.20)
  });
  it('routes squarish creatives to the rectangle slot', () => {
    expect(classifyShape(300, 250)).toBe('rect');  // medium rectangle (1.20)
    expect(classifyShape(250, 250)).toBe('rect');  // square (1.00)
    expect(classifyShape(300, 400)).toBe('rect');  // gentle portrait (0.75) — not tall enough
  });
  it('falls back to rectangle when dimensions are unknown', () => {
    expect(classifyShape(null, null)).toBe('rect');
    expect(classifyShape(0, 0)).toBe('rect');
    expect(classifyShape(undefined, undefined)).toBe('rect');
  });
});

describe('pairCreatives', () => {
  it('pairs one banner + one rectangle into a single two-slot ad', () => {
    expect(pairCreatives([{ url: 'w.png', shape: 'wide' }, { url: 'r.png', shape: 'rect' }]))
      .toEqual([{ imageWide: 'w.png', imageRect: 'r.png', imageTall: null }]);
  });
  it('pairs banner + rectangle + skyscraper into one three-slot ad', () => {
    expect(pairCreatives([
      { url: 'w.png', shape: 'wide' }, { url: 'r.png', shape: 'rect' }, { url: 't.png', shape: 'tall' },
    ])).toEqual([{ imageWide: 'w.png', imageRect: 'r.png', imageTall: 't.png' }]);
  });
  it('never stuffs one image into another slot', () => {
    expect(pairCreatives([{ url: 'only.png', shape: 'tall' }]))
      .toEqual([{ imageWide: null, imageRect: null, imageTall: 'only.png' }]);
  });
  it('makes single-slot ads for leftovers of the same shape', () => {
    const out = pairCreatives([
      { url: 'w1', shape: 'wide' }, { url: 'w2', shape: 'wide' }, { url: 'r1', shape: 'rect' }, { url: 't1', shape: 'tall' },
    ]);
    expect(out).toEqual([
      { imageWide: 'w1', imageRect: 'r1', imageTall: 't1' },
      { imageWide: 'w2', imageRect: null, imageTall: null },
    ]);
  });
  it('returns nothing for no creatives', () => {
    expect(pairCreatives([])).toEqual([]);
  });
});
