import { describe, it, expect } from 'vitest';
import { renderCopy, EMAIL_TEMPLATES, sampleVars } from './emailTemplates';

describe('renderCopy — merge tags', () => {
  const vars = { vendorName: 'PackWise', date: 'Sep 1, 2026', submitUrl: 'https://form.jotform.com/abc' };

  it('substitutes tags in the subject and body (text)', () => {
    const out = renderCopy('Hi {vendorName} — due {date}', 'Hello {vendorName}, submit at {submitUrl}.', vars);
    expect(out.subject).toBe('Hi PackWise — due Sep 1, 2026');
    expect(out.text).toBe('Hello PackWise, submit at https://form.jotform.com/abc.');
  });

  it('leaves unknown tags literal so a typo is visible', () => {
    expect(renderCopy('x', 'Hi {vendorNam}', vars).text).toBe('Hi {vendorNam}');
  });

  it('HTML: escapes injected values, makes links clickable, paragraphs the body', () => {
    const out = renderCopy('s', 'Line one {vendorName}\n\nGo {submitUrl}', { vendorName: '<b>x</b> & co', submitUrl: 'https://j.com/a' });
    expect(out.html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; co');   // value escaped
    expect(out.html).not.toContain('<b>x</b>');                    // no raw injection
    expect(out.html).toContain('<a href="https://j.com/a"');        // link made clickable
    expect(out.html).toContain('<p');                               // paragraphed
  });
});

describe('default templates', () => {
  it('the fresh-ads default reads as intended with sample data', () => {
    const t = EMAIL_TEMPLATES.fresh_ads;
    const out = renderCopy(t.subject, t.body, sampleVars('fresh_ads'));
    expect(out.subject).toContain('PackWise');
    expect(out.text).toContain('second batch of 3 ads');
    expect(out.text).toContain('6-Month');
    expect(out.text).toContain('within one work week');
    expect(out.text).toContain('https://');
  });
  it('the renewal default references the end date + renewal', () => {
    const t = EMAIL_TEMPLATES.renewal;
    const out = renderCopy(t.subject, t.body, sampleVars('renewal'));
    expect(out.subject).toContain('December 31, 2026');
    expect(out.text).toMatch(/renew/i);
    expect(out.text).toContain('12-Month');
  });
});
