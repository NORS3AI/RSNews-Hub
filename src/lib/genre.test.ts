import { describe, it, expect } from 'vitest';
import { normalizeGenre, genreLabel, genreBadgeClass } from './genre';

describe('genre', () => {
  it('normalizes known tokens and rejects the rest', () => {
    expect(normalizeGenre('opinion')).toBe('opinion');
    expect(normalizeGenre('SPONSORED')).toBe('sponsored');
    expect(normalizeGenre(' press_release ')).toBe('press_release');
    expect(normalizeGenre('update')).toBe('update');
    expect(normalizeGenre('news')).toBe('');   // unknown → none
    expect(normalizeGenre('')).toBe('');
    expect(normalizeGenre(null)).toBe('');
    expect(normalizeGenre(42)).toBe('');
  });
  it('labels tokens and blanks unknown/empty', () => {
    expect(genreLabel('opinion')).toBe('Opinion');
    expect(genreLabel('press_release')).toBe('Press release');
    expect(genreLabel('')).toBe('');
    expect(genreLabel('nope')).toBe('');
    expect(genreLabel(null)).toBe('');
  });
  it('gives every genre a badge class and a safe fallback', () => {
    expect(genreBadgeClass('sponsored')).toContain('amber');
    expect(genreBadgeClass('opinion')).toContain('violet');
    expect(genreBadgeClass('unknown')).toContain('var(--');
  });
});
