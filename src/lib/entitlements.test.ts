import { describe, it, expect } from 'vitest';
import { entitlementsOf, parseAffiliations, isVendor, isPremium, isStaff, hasAffiliation, brandKey, meetsRequirement } from './entitlements';

describe('parseAffiliations', () => {
  it('splits comma/space lists into normalized keys', () => {
    expect(parseAffiliations('packagehub, PremiumClub')).toEqual(['packagehub', 'premiumclub']);
    expect(parseAffiliations('  a b,c ')).toEqual(['a', 'b', 'c']);
    expect(parseAffiliations('')).toEqual([]);
    expect(parseAffiliations(null)).toEqual([]);
  });
});

describe('entitlementsOf', () => {
  it('normalizes an account (defaults accountType to MEMBER)', () => {
    expect(entitlementsOf({ accountType: 'vendor', tier: 'Premium', affiliations: 'PackageHub', vendorBrand: 'PackWise' }))
      .toEqual({ accountType: 'VENDOR', tier: 'premium', affiliations: ['packagehub'], vendorBrand: 'PackWise' });
    expect(entitlementsOf({})).toEqual({ accountType: 'MEMBER', tier: '', affiliations: [], vendorBrand: '' });
  });
});

describe('predicates', () => {
  const vendor = entitlementsOf({ accountType: 'VENDOR', vendorBrand: 'PackWise' });
  const premiumMember = entitlementsOf({ accountType: 'MEMBER', tier: 'premium', affiliations: 'packagehub' });
  const basic = entitlementsOf({ accountType: 'MEMBER' });
  it('classifies accounts', () => {
    expect(isVendor(vendor)).toBe(true);
    expect(isVendor(basic)).toBe(false);
    expect(isPremium(premiumMember)).toBe(true);
    expect(isPremium(basic)).toBe(false);
    expect(isStaff(entitlementsOf({ accountType: 'staff' }))).toBe(true);
  });
  it('a vendorBrand alone makes an account a vendor', () => {
    expect(isVendor(entitlementsOf({ vendorBrand: 'Acme' }))).toBe(true);
  });
  it('checks affiliations case-insensitively', () => {
    expect(hasAffiliation(premiumMember, 'PackageHub')).toBe(true);
    expect(hasAffiliation(premiumMember, 'other')).toBe(false);
  });
});

describe('meetsRequirement (content gating)', () => {
  const franchisee = entitlementsOf({ accountType: 'MEMBER', tier: 'premium', affiliations: 'packagehub' });
  const basic = entitlementsOf({ accountType: 'MEMBER' });
  it('empty / all / public is open to everyone', () => {
    expect(meetsRequirement(basic, '')).toBe(true);
    expect(meetsRequirement(basic, 'all')).toBe(true);
    expect(meetsRequirement(basic, 'member')).toBe(true);
  });
  it('gates by tier, type, and affiliation', () => {
    expect(meetsRequirement(franchisee, 'premium')).toBe(true);
    expect(meetsRequirement(basic, 'premium')).toBe(false);
    expect(meetsRequirement(franchisee, 'packagehub')).toBe(true); // affiliation gate
    expect(meetsRequirement(basic, 'packagehub')).toBe(false);
    expect(meetsRequirement(entitlementsOf({ accountType: 'VENDOR' }), 'vendor')).toBe(true);
  });
});

describe('brandKey', () => {
  it('lowercases + trims for matching', () => {
    expect(brandKey('  PackWise ')).toBe('packwise');
    expect(brandKey(null)).toBe('');
  });
});
