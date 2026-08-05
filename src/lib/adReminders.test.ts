import { describe, it, expect } from 'vitest';
import { freshAdsEmail, renewalEmail } from './adReminders';

const now = new Date('2026-06-01T00:00:00Z');

describe('freshAdsEmail', () => {
  const e = freshAdsEmail({ vendorName: 'PackWise', flightIndex: 2, startAt: new Date('2026-06-15T00:00:00Z'), now });
  it('names the vendor, flight, and start date', () => {
    expect(e.subject).toContain('June 15, 2026');
    expect(e.text).toContain('PackWise');
    expect(e.text).toContain('Flight 2');
    expect(e.text).toContain('14 days');
    expect(e.html).toContain('June 15, 2026');
  });
  it('escapes the vendor name in the HTML', () => {
    const x = freshAdsEmail({ vendorName: 'A & <b>Co</b>', flightIndex: 1, startAt: now, now });
    expect(x.html).toContain('A &amp; &lt;b&gt;Co&lt;/b&gt;');
    expect(x.html).not.toContain('<b>Co</b>');
  });
});

describe('renewalEmail', () => {
  const e = renewalEmail({ vendorName: 'PackWise', endAt: new Date('2026-06-21T00:00:00Z'), now });
  it('names the vendor and end date', () => {
    expect(e.subject).toContain('June 21, 2026');
    expect(e.text).toContain('PackWise');
    expect(e.text).toContain('ends on June 21, 2026');
    expect(e.text).toContain('20 days');
  });
});
