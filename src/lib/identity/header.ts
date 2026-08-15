// Production identity via trusted proxy headers.
//
// Some setups authenticate at a reverse proxy / API gateway that then injects
// the member on request headers. ONLY safe when the hub is not reachable except
// through that proxy AND the proxy strips any client-supplied copies of these
// headers — otherwise a caller could spoof them. Prefer the JWT provider unless
// you control the proxy. Enable with AUTH_MODE=header.
//
// Defense-in-depth: set PARENT_PROXY_SECRET and have the proxy send it as
// `x-proxy-secret`. When it's set, any request missing/ mismatching that shared
// secret is treated as unauthenticated — so even if a spoofed x-member-* header
// slips through, it can't mint an identity (let alone a staff one). Compared in
// constant time. Leaving it unset preserves the original behavior.

import { headers } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import { inProduction } from '../env';
import type { IdentityProvider, Member } from './types';

const str = (v: string | null): string | null => (v && v.trim() ? v.trim() : null);

function proxySecretOk(given: string | null): boolean {
  const want = process.env.PARENT_PROXY_SECRET;
  if (!want) {
    // FAIL CLOSED in production (mirrors the JWT provider refusing a weak secret):
    // header-trust with no shared secret means a single spoofed x-member-* header
    // could mint an identity — including staff → ADMIN. So in prod, no secret ⇒
    // no header identity is trusted at all. In dev the gate is relaxed for local use.
    return !inProduction();
  }
  const a = Buffer.from(given || '');
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class HeaderIdentityProvider implements IdentityProvider {
  readonly mode = 'header';
  async resolve(): Promise<Member | null> {
    const h = await headers();
    const p = (name: string) => str(h.get(name));
    // When a shared proxy secret is configured, reject anything that doesn't
    // carry it before trusting a single member header.
    if (!proxySecretOk(p('x-proxy-secret'))) return null;
    const externalId = p(process.env.PARENT_HEADER_ID || 'x-member-id');
    if (!externalId) return null;
    const accountType = p(process.env.PARENT_HEADER_ACCOUNT_TYPE || 'x-member-type');
    const staff = p('x-member-staff');
    const aff = p('x-member-affiliations');
    return {
      externalId,
      email: p(process.env.PARENT_HEADER_EMAIL || 'x-member-email'),
      name: p(process.env.PARENT_HEADER_NAME || 'x-member-name'),
      accountType,
      tier: p('x-member-tier'),
      affiliations: aff ? aff.split(/[,\s]+/).filter(Boolean) : [],
      vendorBrand: p('x-member-brand'),
      region: p('x-member-region'),
      storeType: p('x-member-store-type'),
      storeName: p(process.env.PARENT_HEADER_STORE_NAME || 'x-member-store-name'),
      memberCode: p(process.env.PARENT_HEADER_MEMBER_CODE || 'x-member-code'),
      isStaff: staff === 'true' || staff === '1' || accountType === 'STAFF',
    };
  }
}
