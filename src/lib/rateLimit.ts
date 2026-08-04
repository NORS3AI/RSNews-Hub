// Minimal in-memory fixed-window rate limiter.
//
// Best-effort and per-process: behind a multi-instance deployment you'd back this
// with a shared store (Redis). It's here to blunt brute-force / flooding on the
// auth endpoints for single-instance and local-auth deployments (in delegated
// production auth, login/register are disabled anyway). Pure and testable — the
// clock is injectable.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateResult = { ok: boolean; retryAfter: number };

/** Allow up to `limit` hits per `windowMs` for `key`. Returns retryAfter (s) when blocked. */
export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateResult {
  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  return { ok: true, retryAfter: 0 };
}

/** For tests. */
export function _resetRateLimits(): void { buckets.clear(); }

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
