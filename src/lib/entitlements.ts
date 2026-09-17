// Entitlements — what a signed-in account is allowed to see / get, derived from
// the attributes the parent site puts in the login token (accountType, tier,
// affiliations, vendorBrand). Deliberately DATA-DRIVEN and flexible: tier and
// affiliations are free-form, so new membership types or partner networks (e.g.
// a new franchise) work without a code change — you just start sending the value.
//
// Pure (no DB / framework) so it's trivially testable and usable anywhere.

export type AccountLike = {
  accountType?: string | null;
  tier?: string | null;
  affiliations?: string | null;   // comma-separated keys as stored on User
  vendorBrand?: string | null;
};

export type Entitlements = {
  accountType: string;            // normalized upper-case, e.g. 'MEMBER' | 'VENDOR' | 'STAFF'
  tier: string;                   // normalized lower-case, '' if none
  affiliations: string[];         // normalized lower-case keys
  vendorBrand: string;            // '' if not a vendor / unset
};

const norm = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');

/** Split a comma/space-separated affiliation string into normalized keys. */
export function parseAffiliations(raw: unknown): string[] {
  return norm(raw)
    .split(/[,\s]+/)
    .map((s) => s.toLowerCase())
    .filter(Boolean);
}

/** Normalize an account (User row or token member) into entitlements. */
export function entitlementsOf(a: AccountLike): Entitlements {
  return {
    accountType: norm(a.accountType).toUpperCase() || 'MEMBER',
    tier: norm(a.tier).toLowerCase(),
    affiliations: parseAffiliations(a.affiliations),
    vendorBrand: norm(a.vendorBrand),
  };
}

export const isVendor = (e: Entitlements): boolean => e.accountType === 'VENDOR' || e.vendorBrand !== '';
export const isStaff = (e: Entitlements): boolean => e.accountType === 'STAFF';
export const isPremium = (e: Entitlements): boolean => e.tier === 'premium';

/** Whether the account belongs to a given affiliation/network (case-insensitive). */
export const hasAffiliation = (e: Entitlements, key: string): boolean =>
  e.affiliations.includes(key.trim().toLowerCase());

/** A brand key for matching a vendor to their ads/campaigns (case-insensitive). */
export const brandKey = (s: unknown): string => norm(s).toLowerCase();

/**
 * Does this account satisfy a content-gate requirement? `required` is a simple
 * token: '' or 'all' = everyone; 'premium' = premium tier; 'vendor'/'staff' =
 * that account type; anything else is treated as an affiliation key (e.g.
 * 'packagehub'). Flexible on purpose — gates reference groups by string.
 */
export function meetsRequirement(e: Entitlements, required: string): boolean {
  const r = norm(required).toLowerCase();
  if (!r || r === 'all' || r === 'public') return true;
  if (r === 'premium') return isPremium(e);
  if (r === 'vendor') return isVendor(e);
  if (r === 'staff') return isStaff(e);
  if (r === 'member') return true; // any signed-in account is a member
  return hasAffiliation(e, r);
}

/**
 * Can this viewer see content gated by `requirement`? Unlike `meetsRequirement`,
 * this handles the signed-OUT case: gated content (anything but public/'') always
 * requires a signed-in account, so a null/absent account is denied.
 */
export function canViewContent(account: AccountLike | null | undefined, requirement: string): boolean {
  const r = norm(requirement).toLowerCase();
  if (!r || r === 'all' || r === 'public') return true;
  if (!account) return false; // gated content requires sign-in
  return meetsRequirement(entitlementsOf(account), r);
}

/** A human label for a requirement token, for gate screens and badges. */
export function requirementLabel(requirement: string): string {
  const r = norm(requirement).toLowerCase();
  const known: Record<string, string> = {
    premium: 'RS Premium', vendor: 'vendor', staff: 'staff', member: 'members',
    packagehub: 'PackageHub',
  };
  if (!r || r === 'all' || r === 'public') return 'everyone';
  return known[r] ?? norm(requirement);
}
