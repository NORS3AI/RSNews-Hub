import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, clientIp, _resetRateLimits } from './rateLimit';

beforeEach(() => _resetRateLimits());

describe('rateLimit', () => {
  it('allows up to the limit within the window, then blocks', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit('k', 3, 1000, t).ok).toBe(true);
    const blocked = rateLimit('k', 3, 1000, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const t = 2_000_000;
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 1000, t);
    expect(rateLimit('k', 3, 1000, t).ok).toBe(false);
    expect(rateLimit('k', 3, 1000, t + 1001).ok).toBe(true); // new window
  });

  it('tracks keys independently', () => {
    const t = 3_000_000;
    rateLimit('a', 1, 1000, t);
    expect(rateLimit('a', 1, 1000, t).ok).toBe(false);
    expect(rateLimit('b', 1, 1000, t).ok).toBe(true); // different key unaffected
  });
});

describe('clientIp', () => {
  const req = (h: Record<string, string>) => new Request('http://x', { headers: h });
  it('prefers the first x-forwarded-for, then x-real-ip, then unknown', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(req({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(clientIp(req({}))).toBe('unknown');
  });
});
