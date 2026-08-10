import { describe, it, expect } from 'vitest';
import { parsePastedArticle, isLikelyHeading, withAutoAds, blocksToHtml, type ImportBlock } from './simpleImport';

describe('parsePastedArticle', () => {
  it('lifts the title from the first line and byline from a "By ..." line', () => {
    const raw = `USPS Announces Emergency Rate Change\nBy Jane Smith\n\nThe Postal Service said today that rates will rise.\n\nMore details are expected next week.`;
    const p = parsePastedArticle(raw);
    expect(p.title).toBe('USPS Announces Emergency Rate Change');
    expect(p.byline).toBe('Jane Smith');
    expect(p.blocks.map((b) => b.kind)).toEqual(['p', 'p']);
    expect(p.blocks[0].text).toContain('Postal Service');
  });

  it('handles single-newline paragraphs (typical Word paste)', () => {
    const raw = `Title Here\nBy: John Doe\nFirst paragraph.\nSecond paragraph.`;
    const p = parsePastedArticle(raw);
    expect(p.title).toBe('Title Here');
    expect(p.byline).toBe('John Doe');
    expect(p.blocks).toHaveLength(2);
  });

  it('does NOT treat a sentence starting with "By" as a byline', () => {
    const raw = `Some Headline\nBy the time the meeting ended, everyone had agreed on the plan.`;
    const p = parsePastedArticle(raw);
    expect(p.byline).toBe('');
    expect(p.blocks[0].kind).toBe('p');
  });

  it('works with no byline at all', () => {
    const raw = `Just A Title\nA single paragraph of body text follows here.`;
    const p = parsePastedArticle(raw);
    expect(p.title).toBe('Just A Title');
    expect(p.byline).toBe('');
    expect(p.blocks).toHaveLength(1);
  });

  it('detects a sub-heading in the middle of the body', () => {
    const raw = `Big Story\nBy Reporter Name\nIntro paragraph that is reasonably long and ends properly.\nWhat Happens Next\nThe follow-up paragraph explains what happens next in detail.`;
    const p = parsePastedArticle(raw);
    const kinds = p.blocks.map((b) => b.kind);
    expect(kinds).toContain('h');
    const heading = p.blocks.find((b) => b.kind === 'h');
    expect(heading?.text).toBe('What Happens Next');
  });

  it('returns empty structure for empty input', () => {
    expect(parsePastedArticle('   \n  \n')).toEqual({ title: '', byline: '', blocks: [] });
  });
});

describe('isLikelyHeading', () => {
  it('flags short capitalized fragments', () => {
    expect(isLikelyHeading('What Happens Next')).toBe(true);
    expect(isLikelyHeading('The Bottom Line')).toBe(true);
  });
  it('rejects full sentences and bullets and long lines', () => {
    expect(isLikelyHeading('The postal service raised its rates today.')).toBe(false);
    expect(isLikelyHeading('• a bullet point')).toBe(false);
    expect(isLikelyHeading('this starts lowercase so it is probably prose')).toBe(false);
    expect(isLikelyHeading('A heading that goes on and on with far too many words to be a heading really')).toBe(false);
  });
});

describe('withAutoAds', () => {
  const p = (t: string): ImportBlock => ({ kind: 'p', text: t });
  it('adds two ads for a longer article, none for a very short one', () => {
    const long = Array.from({ length: 9 }, (_, i) => p(`Para ${i}`));
    const ads = withAutoAds(long).filter((b) => b.kind === 'ad');
    expect(ads).toHaveLength(2);

    const short = [p('only'), p('two')];
    expect(withAutoAds(short).filter((b) => b.kind === 'ad')).toHaveLength(0);
  });

  it('never places an ad immediately before a heading', () => {
    const blocks: ImportBlock[] = [p('a'), p('b'), { kind: 'h', text: 'Section' }, p('c'), p('d'), p('e'), p('f')];
    const out = withAutoAds(blocks);
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i].kind === 'ad') expect(out[i + 1].kind).not.toBe('h');
    }
  });
});

describe('blocksToHtml', () => {
  it('produces composer-compatible markup and escapes text', () => {
    const html = blocksToHtml([
      { kind: 'h', text: 'A & B <danger>' },
      { kind: 'p', text: 'Body text.' },
      { kind: 'ad', size: 'wide' },
    ]);
    expect(html).toContain('<h2>A &amp; B &lt;danger&gt;</h2>');
    expect(html).toContain('<p>Body text.</p>');
    expect(html).toContain('data-ad-slot=""');
    expect(html).toContain('data-ad-size="wide"');
  });
});
