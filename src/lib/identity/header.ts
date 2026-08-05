// Production identity via trusted proxy headers.
//
// Some setups authenticate at a reverse proxy / API gateway that then injects
// the member on request headers. ONLY safe when the hub is not reachable except
// through that proxy AND the proxy strips any client-supplied copies of these
// headers — otherwise a caller could spoof them. Prefer the JWT provider unless
// you control the proxy. Enable with AUTH_MODE=header.

import { headers } from 'next/headers';
import type { IdentityProvider, Member } from './types';

const str = (v: string | null): string | null => (v && v.trim() ? v.trim() : null);

export class HeaderIdentityProvider implements IdentityProvider {
  readonly mode = 'header';
  async resolve(): Promise<Member | null> {
    const h = await headers();
    const p = (name: string) => str(h.get(name));
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
      isStaff: staff === 'true' || staff === '1' || accountType === 'STAFF',
    };
  }
}
