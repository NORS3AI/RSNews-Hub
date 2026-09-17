import { describe, it, expect } from 'vitest';
import {
  parseContentSubmission, contentFieldMapFromEnv, DEFAULT_CONTENT_FIELD_MAP,
  textToParagraphs, escapeHtml, smartResolve,
} from './contentIntake';

describe('escapeHtml', () => {
  it('escapes the five significant characters', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});

describe('textToParagraphs', () => {
  it('wraps blank-line blocks in <p> and single newlines in <br>', () => {
    expect(textToParagraphs('one\ntwo\n\nthree')).toBe('<p>one<br />two</p><p>three</p>');
  });
  it('escapes markup so plain text cannot inject HTML', () => {
    expect(textToParagraphs('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });
  it('is empty for empty input', () => expect(textToParagraphs('   ')).toBe(''));
});

describe('contentFieldMapFromEnv', () => {
  it('falls back to defaults with no env', () => {
    expect(contentFieldMapFromEnv(undefined)).toEqual(DEFAULT_CONTENT_FIELD_MAP);
  });
  it('overlays overrides from JSON', () => {
    const m = contentFieldMapFromEnv('{"headline":"q5_headline"}');
    expect(m.headline).toBe('q5_headline');
    expect(m.vendorName).toBe(DEFAULT_CONTENT_FIELD_MAP.vendorName);
  });
  it('ignores malformed JSON', () => {
    expect(contentFieldMapFromEnv('{not json')).toEqual(DEFAULT_CONTENT_FIELD_MAP);
  });
});

describe('smartResolve (JotForm auto-name field grabbing)', () => {
  const map = DEFAULT_CONTENT_FIELD_MAP;

  it('grabs fields from JotForm-style q-prefixed auto-names', () => {
    const raw = {
      q3_companyName: 'PackWise',
      q4_email: 'ads@packwise.com',
      q5_articleTitle: 'Ship smarter',
      q6_body: 'Copy here.',
      q9_uploadCreative: ['https://www.jotform.com/uploads/x/a.png'],
    };
    const r = smartResolve(raw, map);
    expect(r.vendorName).toBe('PackWise');
    expect(r.email).toBe('ads@packwise.com');
    expect(r.headline).toBe('Ship smarter');
    expect(r.body).toBe('Copy here.');
    expect(r.images).toEqual(['https://www.jotform.com/uploads/x/a.png']);
  });

  it('ignores payment / plan / contact fields entirely', () => {
    const raw = {
      q1_company: 'X', q2_headline: 'H', q3_body: 'B',
      q10_paymentAmount: '300', q11_package: 'Premium', q12_price: '$300',
      q13_phoneNumber: '555-1212', q14_billingAddress: '1 Main St',
    };
    const r = smartResolve(raw, map);
    // none of the payment/plan/contact values leak into a grabbed field
    const grabbed = Object.values(r);
    for (const junk of ['300', 'Premium', '$300', '555-1212', '1 Main St']) {
      expect(grabbed).not.toContain(junk);
    }
  });

  it('requires the creative field to actually contain URLs (no text posing as an upload)', () => {
    const raw = { company: 'X', headline: 'H', body: 'B', creative: 'not a url' };
    const r = smartResolve(raw, map);
    expect(r.images).toBeUndefined();
  });

  it('separates the company from the contact PERSON (companyName ≠ Full Name)', () => {
    const raw = { q1_companyName: 'PackWise LLC', q2_fullName: 'Jordan Lee', q3_email: 'j@packwise.com', q4_body: 'Copy.' };
    const r = smartResolve(raw, map);
    expect(r.vendorName).toBe('PackWise LLC');  // company field claimed first
    expect(r.contactName).toBe('Jordan Lee');   // person field, not the company
  });

  it('does not mistake the company field for the contact name', () => {
    const raw = { company: 'PackWise', headline: 'H', body: 'B' }; // no person field
    const r = smartResolve(raw, map);
    expect(r.vendorName).toBe('PackWise');
    expect(r.contactName).toBeUndefined();
  });

  it('an explicit map key wins over a keyword guess', () => {
    const custom = { ...map, headline: 'q7_pickThis' };
    const raw = { q7_pickThis: 'Right', q8_title: 'Wrong' };
    const r = smartResolve(raw, custom);
    expect(r.headline).toBe('Right');
  });
});

describe('parseContentSubmission', () => {
  const map = DEFAULT_CONTENT_FIELD_MAP;

  it('parses a full submission', () => {
    const p = parseContentSubmission({
      company: '  PackWise LLC ',
      email: 'ads@packwise.com',
      headline: 'Ship smarter this season',
      body: 'First para.\n\nSecond para.',
      ctaLabel: 'Get a demo',
      ctaHref: 'https://packwise.com/demo',
      creative: ['https://www.jotform.com/uploads/x/a.png'],
    }, map);
    expect(p.vendorName).toBe('PackWise LLC');
    expect(p.email).toBe('ads@packwise.com');
    expect(p.headline).toBe('Ship smarter this season');
    expect(p.bodyHtml).toBe('<p>First para.</p><p>Second para.</p>');
    expect(p.ctaLabel).toBe('Get a demo');
    expect(p.ctaHref).toBe('https://packwise.com/demo');
    expect(p.imageUrls).toEqual(['https://www.jotform.com/uploads/x/a.png']);
    expect(p.issues).toEqual([]);
  });

  it('drops an invalid email and a non-http CTA', () => {
    const p = parseContentSubmission({
      company: 'X', headline: 'H', body: 'B',
      email: 'not-an-email', ctaHref: 'javascript:alert(1)', ctaLabel: 'Click',
      creative: 'https://www.jotform.com/uploads/x/a.png',
    }, map);
    expect(p.email).toBe('');
    expect(p.ctaHref).toBe('');
    expect(p.ctaLabel).toBe(''); // no label without a valid href
  });

  it('collects issues for missing pieces', () => {
    const p = parseContentSubmission({}, map);
    expect(p.vendorName).toBe('');
    expect(p.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('company name'),
      expect.stringContaining('headline'),
      expect.stringContaining('body'),
      expect.stringContaining('creative'),
    ]));
  });

  it('caps an oversized company name (DoS / junk-row guard)', () => {
    const p = parseContentSubmission({ company: 'X'.repeat(5000), headline: 'H', body: 'B' }, map);
    expect(p.vendorName.length).toBe(120);
  });

  it('defaults a missing CTA label when an href is present', () => {
    const p = parseContentSubmission({ company: 'X', headline: 'H', body: 'B', ctaHref: 'https://x.io' }, map);
    expect(p.ctaHref).toBe('https://x.io');
    expect(p.ctaLabel).toBe('Learn more');
  });
});
