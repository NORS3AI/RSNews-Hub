import { describe, it, expect } from 'vitest';
import {
  normalizeTree, emptyTree, makeBlock, serializeTree, parseTree, isHexColor,
  MAX_BLOCKS, customModuleId, isCustomModuleId, customIdOf,
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
    expect(makeBlock('article', 'x').settings).toEqual({ source: 'latest', showDek: true });
    expect(makeBlock('poll', 'p').settings).toMatchObject({ timerHours: 72, options: ['', ''] });
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

  it('sanitizes poll settings: pads options to 2, clamps timer', () => {
    const t = normalizeTree({ children: [{ type: 'poll', settings: { options: ['only'], timerHours: -5, question: 'Q' } }] });
    const s = t.children[0].settings;
    expect((s.options as string[]).length).toBe(2);
    expect(s.timerHours).toBe(72); // invalid → default
    expect(s.question).toBe('Q');
  });

  it('whitelists settings keys — unknown fields are stripped', () => {
    const t = normalizeTree({ children: [{ type: 'ad', settings: { slot: 'auto', evil: '<script>' } }] });
    expect(t.children[0].settings).toEqual({ slot: 'auto' });
  });

  it('round-trips through serialize/parse', () => {
    const t = normalizeTree({ shape: 'grid', children: [makeBlock('heading', 'h'), makeBlock('text', 't')] });
    expect(parseTree(serializeTree(t))).toEqual(t);
  });

  it('parseTree degrades bad JSON to an empty tree', () => {
    expect(parseTree('not json{')).toEqual(emptyTree());
    expect(parseTree(null)).toEqual(emptyTree());
  });

  it('namespaces custom module ids', () => {
    expect(customModuleId('abc')).toBe('custom:abc');
    expect(isCustomModuleId('custom:abc')).toBe(true);
    expect(isCustomModuleId('latest')).toBe(false);
    expect(customIdOf('custom:abc')).toBe('abc');
    expect(customIdOf('latest')).toBeNull();
  });
});
