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

describe('sanitizeArticleHtml — article composer elements survive a save', () => {
  it('keeps the ad-slot marker + its advertiser lock (brand + size)', () => {
    const out = sanitizeArticleHtml('<div data-ad-slot="" data-ad-brand="brewcrate" data-ad-size="rectangle" data-ad-label="BrewCrate"></div>');
    expect(out).toContain('data-ad-slot');
    expect(out).toContain('data-ad-brand="brewcrate"');
    expect(out).toContain('data-ad-size="rectangle"');
    expect(out).toContain('data-ad-label="BrewCrate"');
  });

  it('keeps the blank-space marker + size (height comes from CSS, not inline style)', () => {
    const out = sanitizeArticleHtml('<div data-spacer="" data-size="lg" style="height:64px"></div>');
    expect(out).toContain('data-spacer');
    expect(out).toContain('data-size="lg"');
    expect(out).not.toContain('style');
  });

  it('keeps the reserved sponsor-ad marker (data-ad-id + label) so it survives a save', () => {
    const out = sanitizeArticleHtml('<div data-ad-id="cmabc123" data-ad-label="PackWise"></div>');
    expect(out).toContain('data-ad-id="cmabc123"');
    expect(out).toContain('data-ad-label="PackWise"');
  });

  it('keeps poll and quiz embed markers', () => {
    const out = sanitizeArticleHtml('<div data-poll="p1" data-label="Best tool?"></div><div data-quiz="q1"></div>');
    expect(out).toContain('data-poll="p1"');
    expect(out).toContain('data-quiz="q1"');
    expect(out).toContain('data-label="Best tool?"');
  });

  it('keeps the full author card', () => {
    const out = sanitizeArticleHtml('<div data-author="" data-name="Dana" data-title="Guest" data-avatar="/u/x.jpg" data-bio="Bio here" data-inhouse="0"></div>');
    for (const a of ['data-author', 'data-name="Dana"', 'data-title="Guest"', 'data-avatar="/u/x.jpg"', 'data-bio="Bio here"', 'data-inhouse="0"']) {
      expect(out).toContain(a);
    }
  });

  it('keeps the button (a-btn class + data-button) and the pull-quote class', () => {
    const btn = sanitizeArticleHtml('<a data-button="" class="a-btn" href="https://x.com">Go</a>');
    expect(btn).toContain('class="a-btn"');
    expect(btn).toContain('data-button');
    expect(btn).toContain('rel="noopener noreferrer nofollow"');
    const pq = sanitizeArticleHtml('<blockquote data-pullquote="" class="pullquote">Quote</blockquote>');
    expect(pq).toContain('class="pullquote"');
    expect(pq).toContain('data-pullquote');
  });

  it('still blocks XSS smuggled through the widened allowlist', () => {
    // a div is allowed now, but not with handlers, styles, arbitrary classes or unknown data-*
    expect(sanitizeArticleHtml('<div data-author="" onclick="alert(1)"></div>')).not.toContain('onclick');
    expect(sanitizeArticleHtml('<div data-ad-slot="" style="position:fixed"></div>')).not.toContain('style');
    expect(sanitizeArticleHtml('<div class="evil" data-spacer=""></div>')).not.toContain('evil');
    expect(sanitizeArticleHtml('<div data-evil="1"></div>')).not.toContain('data-evil');
    // only a-btn / pullquote class values pass
    expect(sanitizeArticleHtml('<a class="evil" href="https://x.com">x</a>')).not.toContain('evil');
  });
});
