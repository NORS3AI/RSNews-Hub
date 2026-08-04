// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fragmentToClipText, clampBlocks } from './quoteImage';

// Build an element from an HTML string (mirrors what a cloned selection range
// looks like: a slice of the article body).
function frag(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

describe('fragmentToClipText — block separation (bug: heading runs into paragraph)', () => {
  it('keeps a heading and the paragraph below it on separate lines', () => {
    const el = frag('<h2>Authentication</h2><p>Hash passwords, use secure sessions, and enforce least privilege.</p>');
    expect(fragmentToClipText(el)).toBe('Authentication\nHash passwords, use secure sessions, and enforce least privilege.');
  });

  it('separates multiple headings + paragraphs in order', () => {
    const el = frag('<h2>Authentication</h2><p>Hash passwords.</p><h2>Data protection</h2><p>Encrypt in transit and at rest.</p>');
    expect(fragmentToClipText(el).split('\n')).toEqual([
      'Authentication',
      'Hash passwords.',
      'Data protection',
      'Encrypt in transit and at rest.',
    ]);
  });

  it('collapses inner whitespace and treats <br> as a space, not a block break', () => {
    const el = frag('<p>Line one<br>still one   paragraph</p>');
    expect(fragmentToClipText(el)).toBe('Line one still one paragraph');
  });

  it('walks a DocumentFragment (what a cloned selection range actually is)', () => {
    // Regression: a fragment is nodeType 11 — the walker must descend into it,
    // not bail out (which produced empty clips in the browser).
    const t = document.createElement('template');
    t.innerHTML = '<h2>Authentication</h2><p>Hash passwords.</p>';
    const out = fragmentToClipText(t.content);
    expect(out).toBe('Authentication\nHash passwords.');
  });
});

describe('fragmentToClipText — ad stripping (bug: ad text lands mid-quote)', () => {
  it('drops an in-flow house ad between two paragraphs', () => {
    const el = frag(
      '<p>Security is everyone&rsquo;s responsibility.</p>' +
      '<div class="had" data-ad-brand="BrewCrate"><p class="had-head">BrewCrate — freshly-roasted coffee. Shop now →</p></div>' +
      '<p>Authentication matters.</p>',
    );
    const out = fragmentToClipText(el);
    expect(out).not.toMatch(/BrewCrate|Shop now/);
    expect(out.split('\n')).toEqual(['Security is everyone’s responsibility.', 'Authentication matters.']);
  });

  it('drops figures, buttons and the clip hint', () => {
    const el = frag('<div class="clip-hint">Tip: highlight text</div><p>Real body.</p><button>Save</button>');
    expect(fragmentToClipText(el)).toBe('Real body.');
  });
});

describe('clampBlocks', () => {
  it('keeps blocks whole under the budget', () => {
    expect(clampBlocks(['abc', 'def'], 100)).toEqual(['abc', 'def']);
  });

  it('truncates on a word boundary with an ellipsis and keeps earlier blocks', () => {
    const out = clampBlocks(['Short heading', 'A much longer paragraph that keeps going and going past the limit'], 30);
    expect(out[0]).toBe('Short heading');
    expect(out[1].endsWith('…')).toBe(true);
    expect(out.join(' ').length).toBeLessThanOrEqual(40);
  });
});
