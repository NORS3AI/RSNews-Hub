import { describe, it, expect } from 'vitest';
import { MEMBER_PRESETS, vendorPresetKey, vendorPreset, resolveViewAs, applyViewAs, VIEW_AS_COOKIE } from './viewAs';
import { entitlementsOf, isVendor, isPremium, hasAffiliation } from './entitlements';

describe('view-as presets', () => {
  it('member presets map to the expected entitlements', () => {
    const byKey = Object.fromEntries(MEMBER_PRESETS.map((p) => [p.key, p]));
    expect(isPremium(entitlementsOf(byKey['member-premium'].account))).toBe(true);
    expect(hasAffiliation(entitlementsOf(byKey['member-packagehub'].account), 'packagehub')).toBe(true);
    const basic = entitlementsOf(byKey['member-basic'].account);
    expect(isPremium(basic)).toBe(false);
    expect(isVendor(basic)).toBe(false);
  });

  it('vendor preset carries the brand and reads as a vendor', () => {
    const p = vendorPreset('RSA');
    expect(p.key).toBe('vendor:rsa');
    expect(isVendor(entitlementsOf(p.account))).toBe(true);
    expect(entitlementsOf(p.account).vendorBrand).toBe('RSA');
  });
});

describe('resolveViewAs', () => {
  const brands = ['RSA', 'PackageHub', 'PackWise'];
  it('resolves a member preset key', () => {
    expect(resolveViewAs('member-premium', brands)?.key).toBe('member-premium');
  });
  it('resolves a vendor key only for a real brand (case-insensitive)', () => {
    expect(resolveViewAs('vendor:packagehub', brands)?.label).toBe('PackageHub (vendor)');
    expect(resolveViewAs(vendorPresetKey('RSA'), brands)?.account.vendorBrand).toBe('RSA');
  });
  it('rejects an unknown brand, empty, or garbage', () => {
    expect(resolveViewAs('vendor:ghostco', brands)).toBeNull();
    expect(resolveViewAs('', brands)).toBeNull();
    expect(resolveViewAs('nonsense', brands)).toBeNull();
    expect(resolveViewAs(undefined, brands)).toBeNull();
  });
});

describe('applyViewAs', () => {
  it('overrides entitlement fields but keeps identity + role', () => {
    const real = { id: 'u1', name: 'Admin', role: 'ADMIN', accountType: 'STAFF', tier: '', affiliations: '', vendorBrand: '' };
    const eff = applyViewAs(real, resolveViewAs('member-premium', [])!);
    expect(eff.id).toBe('u1');
    expect(eff.role).toBe('ADMIN'); // still admin — can switch back
    expect(eff.accountType).toBe('MEMBER'); // impersonated
    expect(isPremium(entitlementsOf(eff))).toBe(true);
  });
  it('tolerates a null real account', () => {
    const eff = applyViewAs(null, vendorPreset('RSA'));
    expect(entitlementsOf(eff).vendorBrand).toBe('RSA');
  });
});

it('cookie name is stable', () => {
  expect(VIEW_AS_COOKIE).toBe('rsnews_viewas');
});
