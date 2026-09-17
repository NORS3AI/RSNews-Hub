// Admin "View as" — lets a staff/admin account preview the site through the
// entitlements of another audience: a basic member, a PackageHub member, a
// premium member, or a specific vendor. It overrides ONLY the four entitlement
// attributes (accountType, tier, affiliations, vendorBrand) used for content
// gating and ad targeting; the real identity, role and admin access are kept, so
// the admin can always switch back. Pure (no DB / framework) so it's testable.
//
// Security: the cookie that carries the choice is honored by the server ONLY
// when the real signed-in account is staff/admin (see viewAsServer.ts). A
// non-admin setting the cookie changes nothing.

import type { AccountLike } from './entitlements';
import { brandKey } from './entitlements';

export const VIEW_AS_COOKIE = 'rsnews_viewas';

export type ViewAsPreset = {
  key: string;
  label: string;
  group: 'Member' | 'Vendor';
  account: AccountLike; // the entitlement attributes to impersonate
};

// Fixed member presets. Vendor presets are generated from the live advertiser
// list so the admin can pick any real brand (RSA, PackageHub, …).
export const MEMBER_PRESETS: ViewAsPreset[] = [
  {
    key: 'member-basic', label: 'Basic member', group: 'Member',
    account: { accountType: 'MEMBER', tier: '', affiliations: '', vendorBrand: '' },
  },
  {
    key: 'member-packagehub', label: 'PackageHub member', group: 'Member',
    account: { accountType: 'MEMBER', tier: '', affiliations: 'packagehub', vendorBrand: '' },
  },
  {
    key: 'member-premium', label: 'Premium member', group: 'Member',
    account: { accountType: 'MEMBER', tier: 'premium', affiliations: '', vendorBrand: '' },
  },
];

/** Cookie/select value for viewing as a given vendor brand. */
export function vendorPresetKey(brand: string): string {
  return `vendor:${brandKey(brand)}`;
}

/** Build a vendor preset for a real brand name. */
export function vendorPreset(brand: string): ViewAsPreset {
  return {
    key: vendorPresetKey(brand),
    label: `${brand} (vendor)`,
    group: 'Vendor',
    account: { accountType: 'VENDOR', tier: '', affiliations: '', vendorBrand: brand },
  };
}

/**
 * Resolve a cookie value to a preset. Member presets are fixed; a `vendor:<key>`
 * value resolves against the provided brand list, so a stale or bogus brand key
 * simply yields null (no impersonation) rather than a phantom vendor.
 */
export function resolveViewAs(cookieVal: string | undefined | null, vendorBrands: string[]): ViewAsPreset | null {
  const v = (cookieVal || '').trim();
  if (!v) return null;
  const member = MEMBER_PRESETS.find((p) => p.key === v);
  if (member) return member;
  if (v.startsWith('vendor:')) {
    const key = v.slice('vendor:'.length);
    const brand = vendorBrands.find((b) => brandKey(b) === key);
    if (brand) return vendorPreset(brand);
  }
  return null;
}

/**
 * Overlay a preset's entitlement attributes onto the real account, keeping every
 * other field (id, name, role, …) intact. Only the four entitlement fields are
 * impersonated, so gating/targeting see the audience while admin access remains.
 */
export function applyViewAs<T extends AccountLike>(real: T | null, preset: ViewAsPreset): T & AccountLike {
  return { ...(real ?? ({} as T)), ...preset.account };
}
