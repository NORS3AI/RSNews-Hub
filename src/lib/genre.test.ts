import { describe, it, expect } from 'vitest';
import { normalizeGenre, genreLabel, genreColor, genreInfo, genreSlugify } from './genre';

describe('genre', () => {
  it('normalizes to built-in tokens by default and rejects the rest', () => {
    expect(normalizeGenre('opinion')).toBe('opinion');
    expect(normalizeGenre('SPONSORED')).toBe('sponsored');
    expect(normalizeGenre(' press_release ')).toBe('press_release');
    expect(normalizeGenre('update')).toBe('update');
    expect(normalizeGenre('news')).toBe('');   // unknown → none
    expect(normalizeGenre('')).toBe('');
    expect(normalizeGenre(null)).toBe('');
    expect(normalizeGenre(42)).toBe('');
  });

  it('validates against a supplied allow-list (the live DB slugs)', () => {
    const allowed = new Set(['opinion', 'history', 'education']);
    expect(normalizeGenre('history', allowed)).toBe('history');   // custom slug OK
    expect(normalizeGenre('opinion', allowed)).toBe('opinion');
    expect(normalizeGenre('update', allowed)).toBe('');           // built-in not in list → rejected
    expect(normalizeGenre('nope', allowed)).toBe('');
  });

  it('labels tokens (built-in fallback) and blanks unknown/empty', () => {
    expect(genreLabel('opinion')).toBe('Opinion');
    expect(genreLabel('press_release')).toBe('Press release');
    expect(genreLabel('')).toBe('');
    expect(genreLabel('nope')).toBe('');
    expect(genreLabel(null)).toBe('');
  });

  it('prefers a runtime map (renamed/custom genres) over the built-in fallback', () => {
    const map = { opinion: { slug: 'opinion', label: 'Hot Take', color: '#111111' }, history: { slug: 'history', label: 'History', color: '#059669' } };
    expect(genreLabel('opinion', map)).toBe('Hot Take');       // renamed built-in
    expect(genreColor('opinion', map)).toBe('#111111');
    expect(genreLabel('history', map)).toBe('History');        // custom genre
    expect(genreInfo('history', map)).toEqual({ slug: 'history', label: 'History', color: '#059669' });
    // slug not in the map falls back to the built-in, then null
    expect(genreLabel('update', map)).toBe('Update');
    expect(genreInfo('history')).toBeNull();                   // no map, not a built-in
  });

  it('resolves colors for built-ins and null for none/unknown', () => {
    expect(genreColor('sponsored')).toBe('#d97706');
    expect(genreColor('opinion')).toBe('#8b5cf6');
    expect(genreColor('')).toBeNull();
    expect(genreColor('unknown')).toBeNull();
  });

  it('slugifies a label into a safe underscore slug', () => {
    expect(genreSlugify('History')).toBe('history');
    expect(genreSlugify('Press Release!')).toBe('press_release');
    expect(genreSlugify('  Ed/Tech  ')).toBe('ed_tech');
    expect(genreSlugify('')).toBe('');
  });
});
