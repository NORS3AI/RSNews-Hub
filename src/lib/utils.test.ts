import { describe, it, expect } from 'vitest';
import { safeLinkHref } from './utils';

// Guards every stored link a lower-trust editor can set (announcement bar, ads).
describe('safeLinkHref', () => {
  it('keeps http(s) and single-slash relative links', () => {
    expect(safeLinkHref('https://example.com/x')).toBe('https://example.com/x');
    expect(safeLinkHref('http://example.com')).toBe('http://example.com');
    expect(safeLinkHref('/docs/page/expo')).toBe('/docs/page/expo');
  });
  it('strips script and offsite schemes to the fallback', () => {
    expect(safeLinkHref('javascript:alert(1)')).toBe('');
    expect(safeLinkHref('  JavaScript:alert(1)')).toBe('');
    expect(safeLinkHref('data:text/html,x')).toBe('');
    expect(safeLinkHref('vbscript:msgbox(1)')).toBe('');
    expect(safeLinkHref('//evil.example.com')).toBe(''); // protocol-relative
    expect(safeLinkHref('relative/no-slash')).toBe('');
  });
  it('honors a custom fallback and blanks empties', () => {
    expect(safeLinkHref('', '#')).toBe('#');
    expect(safeLinkHref('javascript:x', '#')).toBe('#');
    expect(safeLinkHref(null)).toBe('');
    expect(safeLinkHref(undefined, '#')).toBe('#');
  });
});
