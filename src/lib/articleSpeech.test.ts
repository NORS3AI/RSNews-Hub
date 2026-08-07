import { describe, it, expect } from 'vitest';
import { articleToSpeech, speechHash, chunkForTts } from './articleSpeech';

describe('articleToSpeech', () => {
  it('reads the title first, then the prose', () => {
    const out = articleToSpeech('<h2>Section one</h2><p>Hello world.</p>', 'My Headline');
    expect(out.startsWith('My Headline.')).toBe(true);
    expect(out).toContain('Section one.');
    expect(out).toContain('Hello world.');
  });

  it('drops composer element blocks, images, buttons — never spoken', () => {
    const html = [
      '<p>Intro paragraph.</p>',
      '<div data-ad-slot data-ad-brand="acme"></div>',
      '<div data-author data-name="Dana" data-bio="A guest writer."></div>',
      '<div data-poll="p1"></div>',
      '<a data-button class="a-btn" href="/x">Read the full report</a>',
      '<img src="/x.png" alt="a chart">',
      '<div data-spacer data-size="lg"></div>',
      '<p>Closing paragraph.</p>',
    ].join('');
    const out = articleToSpeech(html);
    expect(out).toContain('Intro paragraph.');
    expect(out).toContain('Closing paragraph.');
    expect(out).not.toMatch(/Read the full report/);
    expect(out).not.toMatch(/Dana|guest writer|acme|p1/);
  });

  it('keeps pull-quote text and decodes entities', () => {
    const out = articleToSpeech('<blockquote class="pullquote">Ship &amp; save—always.</blockquote>');
    expect(out).toContain('Ship & save—always.');
  });

  it('adds terminal punctuation so blocks do not run together', () => {
    const out = articleToSpeech('<p>First line</p><p>Second line</p>');
    expect(out).toContain('First line.');
    expect(out).toContain('Second line.');
  });
});

describe('speechHash', () => {
  it('is stable and changes with the text', () => {
    expect(speechHash('abc')).toBe(speechHash('abc'));
    expect(speechHash('abc')).not.toBe(speechHash('abcd'));
  });
});

describe('chunkForTts', () => {
  it('returns one chunk when under the limit', () => {
    expect(chunkForTts('Short text.', 2500)).toEqual(['Short text.']);
  });
  it('splits on sentence boundaries and respects the limit', () => {
    const text = Array.from({ length: 50 }, (_, i) => `Sentence number ${i}.`).join(' ');
    const chunks = chunkForTts(text, 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(120);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text);
  });
  it('hard-splits a single over-long sentence', () => {
    const monster = 'x'.repeat(300);
    const chunks = chunkForTts(monster, 100);
    expect(chunks.length).toBe(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
  });
  it('empty in, empty out', () => {
    expect(chunkForTts('', 100)).toEqual([]);
  });
});
