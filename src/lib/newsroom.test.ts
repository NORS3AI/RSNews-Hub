import { describe, it, expect } from 'vitest';
import { docBodyToArticleHtml, docBodyToBlocks, docBodyToStructuredHtml, isPresenceActive, deriveDocTitle, docPreview, locateQuote, PRESENCE_ACTIVE_MS } from './newsroom';

describe('docBodyToArticleHtml', () => {
  it('splits blank-line paragraphs and keeps single newlines as <br>', () => {
    expect(docBodyToArticleHtml('First para.\n\nSecond para.')).toBe('<p>First para.</p>\n<p>Second para.</p>');
    expect(docBodyToArticleHtml('line one\nline two')).toBe('<p>line one<br>line two</p>');
  });
  it('escapes HTML (the body is prose, never markup)', () => {
    expect(docBodyToArticleHtml('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>');
  });
  it('returns empty for blank input and trims stray blank lines', () => {
    expect(docBodyToArticleHtml('')).toBe('');
    expect(docBodyToArticleHtml('   \n\n  ')).toBe('');
    expect(docBodyToArticleHtml('\n\nreal\n\n\n')).toBe('<p>real</p>');
  });
});

describe('docBodyToBlocks — push structure detection', () => {
  it('detects a short standalone line as a sub-heading', () => {
    const blocks = docBodyToBlocks('Intro paragraph that is a full sentence.\n\nThe Big Reveal\n\nMore prose here in a sentence.');
    expect(blocks).toEqual([
      { kind: 'p', text: 'Intro paragraph that is a full sentence.' },
      { kind: 'h', text: 'The Big Reveal' },
      { kind: 'p', text: 'More prose here in a sentence.' },
    ]);
  });
  it('keeps a multi-line block as one paragraph (not a heading)', () => {
    expect(docBodyToBlocks('Line one\nLine two')).toEqual([{ kind: 'p', text: 'Line one\nLine two' }]);
  });
  it('is empty for blank input', () => {
    expect(docBodyToBlocks('   \n\n ')).toEqual([]);
  });
});

describe('docBodyToStructuredHtml — parity with the paste importer', () => {
  it('emits <h2> for detected sub-heads and preserves intra-paragraph <br>', () => {
    const html = docBodyToStructuredHtml('The Setup\n\nlead line\nsecond line');
    expect(html).toContain('<h2>The Setup</h2>');
    expect(html).toContain('<p>lead line<br>second line</p>');
  });
  it('auto-places ad slots on a long enough story', () => {
    const body = Array.from({ length: 8 }, (_, i) => `Paragraph number ${i + 1} is a real sentence.`).join('\n\n');
    const html = docBodyToStructuredHtml(body);
    expect(html).toContain('data-ad-slot');
  });
  it('is empty for blank input', () => {
    expect(docBodyToStructuredHtml('')).toBe('');
  });
});

describe('presence + previews', () => {
  it('isPresenceActive tracks the freshness window', () => {
    const now = 1_000_000;
    expect(isPresenceActive(new Date(now - 1_000), now)).toBe(true);
    expect(isPresenceActive(new Date(now - PRESENCE_ACTIVE_MS - 1), now)).toBe(false);
  });
  it('deriveDocTitle uses the first non-empty line, else the fallback', () => {
    expect(deriveDocTitle('\n  Big USPS rate news \nmore')).toBe('Big USPS rate news');
    expect(deriveDocTitle('   ')).toBe('Untitled draft');
  });
  it('docPreview flattens whitespace and truncates', () => {
    expect(docPreview('a\n\n  b   c')).toBe('a b c');
    expect(docPreview('x'.repeat(200)).endsWith('…')).toBe(true);
  });
});

describe('locateQuote — re-finding a note anchor', () => {
  const body = 'The USPS surcharge lands Nov 1. Every ecommerce shipper is bracing.';
  it('uses the stored offset when it still matches', () => {
    const start = body.indexOf('ecommerce');
    expect(locateQuote(body, 'ecommerce', start)).toEqual({ start, end: start + 9 });
  });
  it('falls back to a text search when the offset has shifted', () => {
    const shifted = 'PREFIX ADDED. ' + body;
    const oldStart = body.indexOf('ecommerce'); // stale offset from the un-prefixed body
    const found = locateQuote(shifted, 'ecommerce', oldStart);
    expect(found).toEqual({ start: shifted.indexOf('ecommerce'), end: shifted.indexOf('ecommerce') + 9 });
  });
  it('returns null when the passage is gone or empty', () => {
    expect(locateQuote(body, 'no longer here', 0)).toBeNull();
    expect(locateQuote(body, null, null)).toBeNull();
    expect(locateQuote(body, '   ', 3)).toBeNull();
  });
});
