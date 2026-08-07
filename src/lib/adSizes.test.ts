import { describe, it, expect } from 'vitest';
import { classifyShape, pairCreatives } from './adSizes';

describe('classifyShape', () => {
  it('routes wide/letterbox creatives to the banner slot', () => {
    expect(classifyShape(728, 90)).toBe('wide');   // leaderboard
    expect(classifyShape(970, 250)).toBe('wide');  // billboard
    expect(classifyShape(300, 50)).toBe('wide');   // mobile banner
  });
  it('routes squarish / portrait creatives to the rectangle slot', () => {
    expect(classifyShape(300, 250)).toBe('rect');  // medium rectangle
    expect(classifyShape(250, 250)).toBe('rect');  // square
    expect(classifyShape(160, 600)).toBe('rect');  // skyscraper (portrait → rect for now)
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
      .toEqual([{ imageWide: 'w.png', imageRect: 'r.png' }]);
  });
  it('never stuffs one image into both slots', () => {
    const out = pairCreatives([{ url: 'only.png', shape: 'wide' }]);
    expect(out).toEqual([{ imageWide: 'only.png', imageRect: null }]);
  });
  it('makes single-slot ads for leftovers of the same shape', () => {
    const out = pairCreatives([
      { url: 'w1', shape: 'wide' }, { url: 'w2', shape: 'wide' }, { url: 'r1', shape: 'rect' },
    ]);
    expect(out).toEqual([
      { imageWide: 'w1', imageRect: 'r1' },
      { imageWide: 'w2', imageRect: null },
    ]);
  });
  it('returns nothing for no creatives', () => {
    expect(pairCreatives([])).toEqual([]);
  });
});
