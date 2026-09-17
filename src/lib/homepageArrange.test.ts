import { describe, it, expect } from 'vitest';
import { applyLiveReorder, applyReorder, type HomeModule } from './homepage';

const m = (id: string, over: Partial<HomeModule> = {}): HomeModule => ({ id, enabled: true, locked: false, ...over });

describe('applyLiveReorder', () => {
  it('reorders enabled, unlocked modules into the given order', () => {
    const cur = [m('a'), m('b'), m('c')];
    const out = applyLiveReorder(cur, ['c', 'a', 'b']);
    expect(out.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps a locked module pinned to its slot', () => {
    const cur = [m('a'), m('b', { locked: true }), m('c')];
    // Client can only reorder the movable ones (a, c); b stays in slot 2.
    const out = applyLiveReorder(cur, ['c', 'a']);
    expect(out.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('keeps a hidden module pinned to its slot', () => {
    const cur = [m('a'), m('b', { enabled: false }), m('c')];
    const out = applyLiveReorder(cur, ['c', 'a']);
    expect(out.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('pins an enabled module that was omitted (e.g. rendered empty)', () => {
    // b is enabled+unlocked but NOT in the ordered list → must stay put, and the
    // mapping for the others must not drift.
    const cur = [m('a'), m('b'), m('c'), m('d')];
    const out = applyLiveReorder(cur, ['d', 'a', 'c']); // b omitted
    // b pins at its index (1); the fill slots (0,2,3) take d,a,c in order.
    expect(out.map((x) => x.id)).toEqual(['d', 'b', 'a', 'c']);
    expect(out[1].id).toBe('b');
    // No duplicates, no drops.
    expect(new Set(out.map((x) => x.id)).size).toBe(4);
  });

  it('is robust to a duplicated id in the input (no drop, no dupe)', () => {
    const cur = [m('a'), m('b'), m('c')];
    const out = applyLiveReorder(cur, ['a', 'a', 'b']); // 'a' repeated, 'c' omitted
    // Dedupe → treat as ['a','b']; 'c' is enabled+unlocked but omitted, so pinned.
    expect(new Set(out.map((x) => x.id)).size).toBe(3); // no duplicates
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']); // nothing dropped
  });

  it('is a no-op when the order matches', () => {
    const cur = [m('a'), m('b'), m('c')];
    expect(applyLiveReorder(cur, ['a', 'b', 'c']).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('applyReorder (admin drag, honors locks)', () => {
  it('reorders unlocked modules, keeps locked ones pinned', () => {
    const cur = [m('a'), m('b', { locked: true }), m('c')];
    expect(applyReorder(cur, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('is robust to a duplicated id (no drop, no dupe)', () => {
    const cur = [m('a'), m('b'), m('c')];
    const out = applyReorder(cur, ['a', 'a', 'b']); // 'a' repeated
    expect(new Set(out.map((x) => x.id)).size).toBe(3); // no duplicate module
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']); // none dropped
  });
});
