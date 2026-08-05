import { describe, it, expect } from 'vitest';
import { parseJotformSubmission, resolvePlanKey, collectUrls, parseDate, isAllowedCreativeHost, fieldMapFromEnv, DEFAULT_FIELD_MAP } from './jotform';

describe('resolvePlanKey', () => {
  it('maps labels/keys to a plan key', () => {
    expect(resolvePlanKey('3-Month')).toBe('quarter');
    expect(resolvePlanKey('6 month package')).toBe('half');
    expect(resolvePlanKey('12-Month')).toBe('annual');
    expect(resolvePlanKey('Premium (video)')).toBe('premium');
    expect(resolvePlanKey('Holiday / Seasonal')).toBe('holiday');
    expect(resolvePlanKey('annual')).toBe('annual');
  });
  it('falls back to quarter on unknown/blank', () => {
    expect(resolvePlanKey('')).toBe('quarter');
    expect(resolvePlanKey('mystery')).toBe('quarter');
  });
});

describe('collectUrls', () => {
  it('gathers http(s) urls from arrays, lists, and objects; dedupes', () => {
    expect(collectUrls(['https://a/1.png', 'https://a/2.png'])).toEqual(['https://a/1.png', 'https://a/2.png']);
    expect(collectUrls('https://a/1.png https://a/2.png')).toEqual(['https://a/1.png', 'https://a/2.png']);
    expect(collectUrls('https://a/1.png, https://a/1.png')).toEqual(['https://a/1.png']);
    expect(collectUrls('not a url')).toEqual([]);
  });
});

describe('parseDate', () => {
  it('parses ISO strings and JotForm {month,day,year}', () => {
    expect(parseDate('2026-09-01')?.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(parseDate({ month: '9', day: '1', year: '2026' })?.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(parseDate('')).toBeNull();
    expect(parseDate('garbage')).toBeNull();
  });
});

describe('parseJotformSubmission', () => {
  const raw = {
    vendorName: 'PackWise',
    package: '6-Month',
    startDate: { month: '9', day: '1', year: '2026' },
    notes: 'Fall campaign',
    ads: ['https://www.jotform.com/uploads/x/1.png', 'https://www.jotform.com/uploads/x/2.png'],
  };
  it('maps the canonical fields', () => {
    const p = parseJotformSubmission(raw, DEFAULT_FIELD_MAP);
    expect(p.vendorName).toBe('PackWise');
    expect(p.planKey).toBe('half');
    expect(p.startAt?.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(p.notes).toBe('Fall campaign');
    expect(p.imageUrls).toHaveLength(2);
    expect(p.issues).toEqual([]);
  });
  it('records non-fatal issues for missing vendor/images', () => {
    const p = parseJotformSubmission({ package: '3-Month' }, DEFAULT_FIELD_MAP);
    expect(p.vendorName).toBe('');
    expect(p.imageUrls).toEqual([]);
    expect(p.issues.length).toBe(2);
  });
});

describe('fieldMapFromEnv', () => {
  it('overrides defaults per-key and tolerates junk', () => {
    expect(fieldMapFromEnv('{"vendorName":"q3_company"}').vendorName).toBe('q3_company');
    expect(fieldMapFromEnv('{"vendorName":"q3_company"}').plan).toBe(DEFAULT_FIELD_MAP.plan);
    expect(fieldMapFromEnv('not json')).toEqual(DEFAULT_FIELD_MAP);
    expect(fieldMapFromEnv(undefined)).toEqual(DEFAULT_FIELD_MAP);
  });
});

describe('isAllowedCreativeHost (SSRF guard)', () => {
  it('allows https JotForm .com hosts only', () => {
    expect(isAllowedCreativeHost('https://www.jotform.com/uploads/x/1.png')).toBe(true);
    expect(isAllowedCreativeHost('https://eu.jotform.com/a.png')).toBe(true);
    expect(isAllowedCreativeHost('https://files.jotformpro.com/a/b.png')).toBe(true);
  });
  it('blocks non-JotForm hosts, http, credentials, .io variants, and internal targets', () => {
    expect(isAllowedCreativeHost('https://evil.com/x.png')).toBe(false);
    expect(isAllowedCreativeHost('http://www.jotform.com/x.png')).toBe(false); // not https
    expect(isAllowedCreativeHost('https://user:pass@www.jotform.com/x.png')).toBe(false);
    expect(isAllowedCreativeHost('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedCreativeHost('https://jotform.com.evil.com/x.png')).toBe(false);
    expect(isAllowedCreativeHost('https://files.jotform.io/a/b.png')).toBe(false); // .io not verified-owned
    expect(isAllowedCreativeHost('not a url')).toBe(false);
  });
});
