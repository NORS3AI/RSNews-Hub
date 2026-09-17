import { describe, it, expect, afterEach, vi } from 'vitest';
import { isEmailConfigured, escapeHtml, renderEmail, sendEmail } from './email';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('isEmailConfigured', () => {
  it('is false unless BOTH api key and from address are set', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    expect(isEmailConfigured()).toBe(false);
    vi.stubEnv('RESEND_API_KEY', 're_abc');
    expect(isEmailConfigured()).toBe(false); // from still missing
    vi.stubEnv('EMAIL_FROM', 'no-reply@x.com');
    expect(isEmailConfigured()).toBe(true);
  });
});

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml(`<script>"a"&'b'`)).toBe('&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;');
  });
});

describe('renderEmail', () => {
  it('escapes the title but keeps the trusted body HTML', () => {
    const html = renderEmail('<b>hi</b>', '<p>trusted</p>');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;'); // title escaped
    expect(html).toContain('<p>trusted</p>'); // body verbatim
    expect(html).toContain('RS News Hub');
  });

  it('carries a physical mailing address in the footer (CAN-SPAM)', () => {
    const html = renderEmail('Hi', '<p>x</p>');
    // The address block is always present; env-driven value falls back to a
    // clearly-marked placeholder so an unconfigured deploy is obvious.
    expect(html).toMatch(/MAILING_ADDRESS|·/);
    expect(html.toLowerCase()).toContain('receiving this');
  });
});

describe('sendEmail', () => {
  it('rejects an invalid recipient without hitting the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await sendEmail({ to: 'not-an-email', subject: 's', html: '<p>x</p>' });
    expect(r).toEqual({ ok: false, error: 'invalid recipient' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips (no-op) and never sends when no provider is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await sendEmail({ to: 'reader@example.com', subject: 'Hi', html: '<p>x</p>' });
    expect(r).toEqual({ ok: true, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs to the provider when configured', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('EMAIL_FROM', 'no-reply@x.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const r = await sendEmail({ to: 'reader@example.com', subject: 'Hi', html: '<p>x</p>' });
    expect(r).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer re_secret');
    expect(JSON.parse(init!.body as string).to).toBe('reader@example.com');
  });

  it('reports a provider error without throwing', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('EMAIL_FROM', 'no-reply@x.com');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 422 }));
    const r = await sendEmail({ to: 'reader@example.com', subject: 'Hi', html: '<p>x</p>' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('422');
  });

  it('swallows a transport exception', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('EMAIL_FROM', 'no-reply@x.com');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const r = await sendEmail({ to: 'reader@example.com', subject: 'Hi', html: '<p>x</p>' });
    expect(r).toEqual({ ok: false, error: 'transport error' });
  });
});
