import { describe, it, expect } from 'vitest';
import { sanitizeArticleHtml } from './sanitize';

describe('sanitizeArticleHtml', () => {
  it('keeps allowed formatting tags', () => {
    const html = '<h2>Title</h2><p>Hello <strong>world</strong> and <em>more</em>.</p><ul><li>one</li></ul>';
    expect(sanitizeArticleHtml(html)).toBe(html);
  });

  it('strips <script> and its contents', () => {
    expect(sanitizeArticleHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
  });

  it('strips event handlers and inline styles', () => {
    expect(sanitizeArticleHtml('<img src="/x.png" onerror="alert(1)">')).not.toContain('onerror');
    expect(sanitizeArticleHtml('<p style="position:fixed">x</p>')).toBe('<p>x</p>');
    expect(sanitizeArticleHtml('<p class="evil">x</p>')).toBe('<p>x</p>');
  });

  it('drops javascript: link schemes but keeps http/https/mailto', () => {
    expect(sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    const safe = sanitizeArticleHtml('<a href="https://example.com">x</a>');
    expect(safe).toContain('href="https://example.com"');
  });

  it('forces safe rel/target on links', () => {
    const out = sanitizeArticleHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it('removes disallowed tags like iframe/object/form', () => {
    const out = sanitizeArticleHtml('<iframe src="//evil"></iframe><object></object><form></form><p>ok</p>');
    expect(out).toBe('<p>ok</p>');
  });

  it('handles empty/nullish input', () => {
    expect(sanitizeArticleHtml('')).toBe('');
    // @ts-expect-error runtime guard for null
    expect(sanitizeArticleHtml(null)).toBe('');
  });
});
