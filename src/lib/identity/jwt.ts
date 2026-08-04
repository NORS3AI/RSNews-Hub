// Production identity via a JWT the PARENT site issues.
//
// The website, after it logs a member in, signs a short-lived JWT (HS256 with a
// secret shared with the hub) and either sets it as a cookie on the shared
// domain or sends it as `Authorization: Bearer`. The hub verifies it and maps
// the claims to a Member. Minimal required claim: `sub` (the account id).
//
// Claims read (all optional except sub):
//   sub          → externalId          email → email        name → name
//   accountType  → accountType (MEMBER|VENDOR|STAFF)
//   region, storeType → audience facets
//   roles: []    → isStaff if it includes "admin"/"staff"  (or accountType STAFF)

import { cookies, headers } from 'next/headers';
import { jwtVerify } from 'jose';
import { log } from '../logger';
import { secretIsWeak, inProduction } from '../env';
import type { IdentityProvider, Member } from './types';

function secret(): Uint8Array | null {
  const s = process.env.PARENT_JWT_SECRET;
  if (!s) return null;
  // The parent JWT is the entire production admin trust boundary — a weak/short
  // shared secret is offline-brute-forceable, so refuse it loudly in production
  // (fails closed: no member is authenticated until it's fixed).
  if (secretIsWeak(s) && inProduction()) {
    throw new Error('PARENT_JWT_SECRET must be a strong, unique value (24+ chars) in production. Generate one with:  openssl rand -base64 48');
  }
  return new TextEncoder().encode(s);
}

async function readToken(): Promise<string | null> {
  const cookieName = process.env.PARENT_SESSION_COOKIE || 'rsnews_sso';
  const fromCookie = (await cookies()).get(cookieName)?.value;
  if (fromCookie) return fromCookie;
  const auth = (await headers()).get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function memberFromClaims(p: Record<string, unknown>): Member | null {
  const externalId = str(p.sub) || str(p.accountId) || str(p.uid);
  if (!externalId) return null;
  const roles = Array.isArray(p.roles) ? p.roles.map((r) => String(r).toLowerCase()) : [];
  const accountType = str(p.accountType);
  return {
    externalId,
    email: str(p.email),
    name: str(p.name) || str(p.displayName),
    accountType,
    region: str(p.region),
    storeType: str(p.storeType),
    isStaff: roles.includes('admin') || roles.includes('staff') || accountType === 'STAFF',
  };
}

export class JwtIdentityProvider implements IdentityProvider {
  readonly mode = 'jwt';
  async resolve(): Promise<Member | null> {
    const key = secret();
    if (!key) { log.warn('AUTH_MODE=jwt but PARENT_JWT_SECRET is unset'); return null; }
    const token = await readToken();
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],          // pin the alg — no alg-confusion / "none" downgrade
        requiredClaims: ['exp'],        // reject tokens minted to never expire
        issuer: process.env.PARENT_JWT_ISSUER || undefined,
        audience: process.env.PARENT_JWT_AUDIENCE || undefined,
        clockTolerance: 5,              // small leeway for clock skew
      });
      return memberFromClaims(payload as Record<string, unknown>);
    } catch (e) {
      log.warn('parent JWT verification failed', { err: (e as Error).message });
      return null; // invalid/expired token → treated as signed-out
    }
  }
}
