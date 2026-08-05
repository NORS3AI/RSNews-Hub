import { describe, it, expect, afterEach, vi } from 'vitest';
import { memberFromClaims } from './jwt';
import { authMode, isDelegatedAuth } from './index';

afterEach(() => vi.unstubAllEnvs());

describe('memberFromClaims', () => {
  it('maps a full claim set', () => {
    expect(memberFromClaims({ sub: 'acct_1', email: 'a@b.com', name: 'Ada', accountType: 'VENDOR', region: 'West', storeType: 'chain', roles: ['member'] }))
      .toEqual({ externalId: 'acct_1', email: 'a@b.com', name: 'Ada', accountType: 'VENDOR', tier: null, affiliations: [], vendorBrand: null, region: 'West', storeType: 'chain', isStaff: false });
  });

  it('maps entitlement claims (tier, affiliations, vendorBrand/brand)', () => {
    // affiliations as an array
    expect(memberFromClaims({ sub: '1', tier: 'premium', affiliations: ['packagehub', 'PremiumClub'], vendorBrand: 'PackWise' }))
      .toMatchObject({ tier: 'premium', affiliations: ['packagehub', 'PremiumClub'], vendorBrand: 'PackWise' });
    // affiliations as a comma/space string; `brand` is accepted as a vendorBrand alias
    expect(memberFromClaims({ sub: '1', affiliations: 'packagehub premiumclub', brand: 'Acme' }))
      .toMatchObject({ affiliations: ['packagehub', 'premiumclub'], vendorBrand: 'Acme' });
  });

  it('requires an id claim (sub/accountId/uid) or returns null', () => {
    expect(memberFromClaims({ email: 'x@y.com' })).toBeNull();
    expect(memberFromClaims({ accountId: 'a2' })?.externalId).toBe('a2');
    expect(memberFromClaims({ uid: 'a3' })?.externalId).toBe('a3');
  });

  it('flags staff from a roles array or STAFF account type', () => {
    expect(memberFromClaims({ sub: '1', roles: ['admin'] })?.isStaff).toBe(true);
    expect(memberFromClaims({ sub: '1', roles: ['staff'] })?.isStaff).toBe(true);
    expect(memberFromClaims({ sub: '1', accountType: 'STAFF' })?.isStaff).toBe(true);
    expect(memberFromClaims({ sub: '1', roles: ['member'] })?.isStaff).toBe(false);
  });

  it('falls back name → displayName and trims empties to null', () => {
    expect(memberFromClaims({ sub: '1', displayName: 'Dee' })?.name).toBe('Dee');
    expect(memberFromClaims({ sub: '1', email: '   ' })?.email).toBeNull();
  });
});

describe('authMode / isDelegatedAuth', () => {
  it('defaults to local and rejects unknown modes', () => {
    expect(authMode()).toBe('local');
    expect(isDelegatedAuth()).toBe(false);
    vi.stubEnv('AUTH_MODE', 'nonsense');
    expect(authMode()).toBe('local');
  });
  it('honors jwt and header (case-insensitive)', () => {
    vi.stubEnv('AUTH_MODE', 'JWT');
    expect(authMode()).toBe('jwt');
    expect(isDelegatedAuth()).toBe(true);
    vi.stubEnv('AUTH_MODE', 'header');
    expect(authMode()).toBe('header');
  });
});
