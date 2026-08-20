import { describe, it, expect } from 'vitest';
import { resolveByline, bylineInitials, TEAM_BYLINE_NAME } from './byline';

describe('byline resolution', () => {
  const ref = { id: 'b1', name: 'Brandon Gale', title: 'President, RS News', photo: '/u/x.jpg' };

  it('a library byline wins and carries its photo + title', () => {
    expect(resolveByline(ref, 'ignored one-off')).toEqual({
      name: 'Brandon Gale', title: 'President, RS News', photo: '/u/x.jpg', isTeam: false,
    });
  });

  it('a library byline with no photo/title resolves name-only (not team)', () => {
    const r = resolveByline({ id: 'b2', name: 'Jane Doe', title: null, photo: null }, null);
    expect(r).toEqual({ name: 'Jane Doe', title: null, photo: null, isTeam: false });
  });

  it('falls back to a free-text one-off name (no photo/title)', () => {
    expect(resolveByline(null, '  Guest Writer  ')).toEqual({ name: 'Guest Writer', title: null, photo: null, isTeam: false });
  });

  it('defaults to the house team byline when nothing is set', () => {
    expect(resolveByline(null, null)).toEqual({ name: TEAM_BYLINE_NAME, title: null, photo: null, isTeam: true });
    expect(resolveByline(null, '   ')).toEqual({ name: TEAM_BYLINE_NAME, title: null, photo: null, isTeam: true });
    // a ref with a blank name is treated as no ref
    expect(resolveByline({ id: 'x', name: '  ', title: 't', photo: 'p' }, null).isTeam).toBe(true);
  });

  it('bylineInitials takes up to two letters', () => {
    expect(bylineInitials('Brandon Gale')).toBe('BG');
    expect(bylineInitials('Cher')).toBe('C');
    expect(bylineInitials('  mary jane watson ')).toBe('MW');
    expect(bylineInitials('')).toBe('');
  });
});
