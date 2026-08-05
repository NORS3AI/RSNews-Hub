import { describe, it, expect } from 'vitest';
import { firstRunAnchorDelta } from './campaigns';

const day = 86_400_000;

describe('firstRunAnchorDelta — paid clock starts at admin go-live', () => {
  it('slides a past (ingest-dated) start forward to now on first go-live', () => {
    const now = new Date('2026-08-10T00:00:00Z');
    const ingested = new Date('2026-08-01T00:00:00Z'); // submitted 9 days earlier
    expect(firstRunAnchorDelta(ingested, now, false)).toBe(9 * day);
  });

  it('leaves an already-running campaign alone', () => {
    const now = new Date('2026-08-10T00:00:00Z');
    const start = new Date('2026-08-01T00:00:00Z');
    expect(firstRunAnchorDelta(start, now, true)).toBe(0);
  });

  it('honors a vendor-requested future start (no negative slide)', () => {
    const now = new Date('2026-08-10T00:00:00Z');
    const future = new Date('2026-09-01T00:00:00Z');
    expect(firstRunAnchorDelta(future, now, false)).toBe(0);
  });

  it('is a no-op when go-live happens the same instant as the start', () => {
    const t = new Date('2026-08-10T12:00:00Z');
    expect(firstRunAnchorDelta(t, t, false)).toBe(0);
  });
});
