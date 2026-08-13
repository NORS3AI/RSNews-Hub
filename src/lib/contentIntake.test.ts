import { describe, it, expect } from 'vitest';
import {
  parseContentSubmission, contentFieldMapFromEnv, DEFAULT_CONTENT_FIELD_MAP,
  textToParagraphs, escapeHtml,
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

  it('defaults a missing CTA label when an href is present', () => {
    const p = parseContentSubmission({ company: 'X', headline: 'H', body: 'B', ctaHref: 'https://x.io' }, map);
    expect(p.ctaHref).toBe('https://x.io');
    expect(p.ctaLabel).toBe('Learn more');
  });
});
