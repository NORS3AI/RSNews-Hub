import { describe, it, expect } from 'vitest';
import { checkHouseStyle, applySuggestion, applyAll } from './houseStyle';

const apply1 = (text: string) => {
  const s = checkHouseStyle(text);
  return s.length ? applySuggestion(text, s[0]) : text;
};

describe('house-style spelling rules', () => {
  it('forces e-commerce lowercase in every variant', () => {
    for (const v of ['E-commerce', 'E-Commerce', 'eCommerce', 'Ecommerce', 'ecommerce']) {
      const out = checkHouseStyle(`The ${v} boom`);
      // 'ecommerce'/'E-commerce' etc all normalize to 'e-commerce'
      if (v === 'e-commerce') continue;
      expect(out[0]?.replacement).toBe('e-commerce');
    }
    expect(applyAll('An Ecommerce and eCommerce surge', checkHouseStyle('An Ecommerce and eCommerce surge')))
      .toBe('An e-commerce and e-commerce surge');
  });

  it('leaves the already-correct canonical alone', () => {
    expect(checkHouseStyle('The e-commerce boom')).toEqual([]);
    expect(checkHouseStyle('Email us online at the website.')).toEqual([]);
  });

  it('fixes e-mail but preserves sentence-start capitalization', () => {
    expect(apply1('Send an e-mail today')).toBe('Send an email today');
    expect(apply1('E-mail is best')).toBe('Email is best');
  });

  it('normalizes web site / on-line / non-profit and proper names', () => {
    expect(apply1('Visit our web site')).toBe('Visit our website');
    expect(apply1('Go on-line now')).toBe('Go online now');
    expect(apply1('a non-profit group')).toBe('a nonprofit group');
    expect(apply1('shipped via fed ex')).toBe('shipped via FedEx');
    expect(apply1('pay with paypal')).toBe('pay with PayPal');
    expect(apply1('the usps rate')).toBe('the USPS rate');
  });

  it('does not match terms embedded in larger words', () => {
    expect(checkHouseStyle('telecommerce startups')).toEqual([]);
  });
});

describe('oxford comma heuristic', () => {
  it('flags a serial list missing its Oxford comma', () => {
    const text = 'We ship boxes, tape and labels.';
    const out = checkHouseStyle(text);
    const oxford = out.find((s) => s.kind === 'oxford');
    expect(oxford).toBeTruthy();
    expect(applySuggestion(text, oxford!)).toBe('We ship boxes, tape, and labels.');
  });

  it('handles an "or" list too', () => {
    const text = 'Pick red, white or blue.';
    const out = checkHouseStyle(text).filter((s) => s.kind === 'oxford');
    expect(applySuggestion(text, out[0])).toBe('Pick red, white, or blue.');
  });

  it('does not flag an already-correct Oxford list', () => {
    expect(checkHouseStyle('We ship boxes, tape, and labels.').filter((s) => s.kind === 'oxford')).toEqual([]);
  });

  it('does not flag a two-item list or a comma-then-clause', () => {
    expect(checkHouseStyle('boxes and labels').filter((s) => s.kind === 'oxford')).toEqual([]);
    expect(checkHouseStyle('I went to the store, and I bought tape.').filter((s) => s.kind === 'oxford')).toEqual([]);
  });

  it('flags only the missing comma in a longer list', () => {
    const text = 'apples, oranges, pears and bananas';
    const out = checkHouseStyle(text).filter((s) => s.kind === 'oxford');
    expect(out.length).toBe(1);
    expect(applySuggestion(text, out[0])).toBe('apples, oranges, pears, and bananas');
  });
});

describe('applyAll', () => {
  it('applies multiple non-overlapping fixes and keeps indices valid', () => {
    const text = 'Our e-mail and web site cover e-commerce, tape and boxes.';
    const fixed = applyAll(text, checkHouseStyle(text));
    expect(fixed).toBe('Our email and website cover e-commerce, tape, and boxes.');
  });
});
