// Transactional email — provider-agnostic and safe by default.
//
// With no provider configured it LOGS the message instead of sending, so a
// misconfigured environment never accidentally emails anyone. To actually send,
// set EMAIL_FROM (the sender — use one of your own verified addresses) plus one
// provider key:
//   • Resend  — RESEND_API_KEY   (default)
//   • SendGrid — SENDGRID_API_KEY (set EMAIL_PROVIDER=sendgrid, or just supply the key)
// EMAIL_PROVIDER (resend|sendgrid) picks the transport when both keys exist.

import { log } from './logger';

export type EmailMessage = { to: string; subject: string; html: string; text?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Which transport to use, given the configured keys. null = none configured. */
function activeProvider(): 'resend' | 'sendgrid' | null {
  const pref = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (pref === 'sendgrid' && process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (pref === 'resend' && process.env.RESEND_API_KEY) return 'resend';
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  return null;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_FROM && activeProvider());
}

function redact(email: string): string {
  const [user, domain] = email.split('@');
  return domain ? `${user.slice(0, 2)}***@${domain}` : '***';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Wrap trusted body HTML in the branded shell. `title` is escaped. */
export function renderEmail(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#f4f1ea;padding:24px">` +
    `<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)"><tr>` +
    `<td style="background:#232a36;padding:18px 24px"><span style="color:#E97D34;font-weight:800;font-size:18px">RSNews Hub</span></td></tr>` +
    `<tr><td style="padding:24px;color:#232a36"><h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>` +
    `<tr><td style="padding:16px 24px;color:#8a8f98;font-size:12px;border-top:1px solid #eee">You're receiving this because you have an RSNews Hub account.</td></tr></table></body></html>`;
}

async function deliverResend(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) return { ok: false, error: `resend ${res.status}` };
  return { ok: true };
}

async function deliverSendgrid(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const content = [{ type: 'text/plain', value: msg.text || '' }, { type: 'text/html', value: msg.html }]
    .filter((c) => c.value);
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: process.env.EMAIL_FROM },
      subject: msg.subject,
      content,
    }),
  });
  if (!res.ok) return { ok: false, error: `sendgrid ${res.status}` };
  return { ok: true };
}

function deliver(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  return activeProvider() === 'sendgrid' ? deliverSendgrid(msg) : deliverResend(msg);
}

/** Send an email. Never throws; returns a result. No-ops (logs) when unconfigured. */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!EMAIL_RE.test(msg.to)) { log.warn('email rejected: invalid recipient'); return { ok: false, error: 'invalid recipient' }; }
  if (!isEmailConfigured()) {
    log.info('email skipped (no provider configured)', { to: redact(msg.to), subject: msg.subject });
    return { ok: true, skipped: true };
  }
  try {
    const r = await deliver(msg);
    if (!r.ok) log.warn('email send failed', { to: redact(msg.to), error: r.error });
    return r;
  } catch (e) {
    log.warn('email transport error', { to: redact(msg.to), err: (e as Error).message });
    return { ok: false, error: 'transport error' };
  }
}
