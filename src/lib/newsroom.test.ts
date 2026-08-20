import { describe, it, expect } from 'vitest';
import { docBodyToArticleHtml, isPresenceActive, deriveDocTitle, docPreview, PRESENCE_ACTIVE_MS } from './newsroom';

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
