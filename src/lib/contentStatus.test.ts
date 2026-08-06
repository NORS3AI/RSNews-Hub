import { describe, it, expect } from 'vitest';
import { articleStatus, timedStatus, moduleStatus } from './contentStatus';
import { serializeTree, normalizeTree } from './studio';

const now = Date.parse('2026-08-06T12:00:00Z');
const future = '2026-08-20T12:00:00Z';
const past = '2026-08-01T12:00:00Z';
const tree = (children: any[]) => serializeTree(normalizeTree({ shape: 'column', children }));

describe('articleStatus', () => {
  it('maps article states', () => {
    expect(articleStatus({ status: 'DRAFT', publishedAt: null }, now)).toBe('draft');
    expect(articleStatus({ status: 'PUBLISHED', publishedAt: future }, now)).toBe('scheduled');
    expect(articleStatus({ status: 'PUBLISHED', publishedAt: past }, now)).toBe('live');
    expect(articleStatus({ status: 'ARCHIVED', publishedAt: past }, now)).toBe('ended');
  });
});

describe('timedStatus (poll/quiz)', () => {
  it('live when active & open, ended when closed or inactive', () => {
    expect(timedStatus({ active: true, closesAt: future }, now)).toBe('live');
    expect(timedStatus({ active: true, closesAt: null }, now)).toBe('live');
    expect(timedStatus({ active: true, closesAt: past }, now)).toBe('ended');
    expect(timedStatus({ active: false, closesAt: future }, now)).toBe('ended');
  });
});

describe('moduleStatus', () => {
  it('draft when unpublished', () => {
    expect(moduleStatus({ published: false, expiresAt: null, tree: tree([]) }, now)).toBe('draft');
  });
  it('ended when published but expired', () => {
    expect(moduleStatus({ published: true, expiresAt: past, tree: tree([{ type: 'ad', settings: {} }]) }, now)).toBe('ended');
  });
  it('scheduled when every element starts in the future', () => {
    const t = tree([{ type: 'poll', settings: { pollId: 'p' }, startAt: future }]);
    expect(moduleStatus({ published: true, expiresAt: null, tree: t }, now)).toBe('scheduled');
  });
  it('live when published with visible content', () => {
    const t = tree([{ type: 'ad', settings: {} }]);
    expect(moduleStatus({ published: true, expiresAt: null, tree: t }, now)).toBe('live');
  });
});
