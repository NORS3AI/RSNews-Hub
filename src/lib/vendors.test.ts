import { describe, it, expect } from 'vitest';
import { brandKey, sameVendor } from './vendors';

describe('brandKey', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(brandKey('  PackWise ')).toBe('packwise');
    expect(brandKey('PACKWISE')).toBe('packwise');
    expect(brandKey('')).toBe('');
    expect(brandKey(null)).toBe('');
    expect(brandKey(undefined)).toBe('');
  });
});

describe('sameVendor', () => {
  it('treats case/whitespace variants of a name as one vendor', () => {
    expect(sameVendor('PackWise', 'packwise')).toBe(true);
    expect(sameVendor('  PackWise  ', 'PACKWISE')).toBe(true);
  });
  it('distinguishes different vendors', () => {
    expect(sameVendor('PackWise', 'PostalMate')).toBe(false);
  });
  it('never matches on an empty/blank name (no accidental grouping)', () => {
    expect(sameVendor('', '')).toBe(false);
    expect(sameVendor('   ', 'PackWise')).toBe(false);
    expect(sameVendor(null, undefined)).toBe(false);
  });
});
