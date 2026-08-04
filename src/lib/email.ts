// Transactional email — provider-agnostic and safe by default.
//
// With no provider configured it LOGS the message instead of sending, so a
// misconfigured environment never accidentally emails anyone. Set
// RESEND_API_KEY + EMAIL_FROM to actually send (via Resend's REST API — no SDK).
// Swappable for Postmark/SES by editing the one `deliver` function.

import { log } from './logger';

export type EmailMessage = { to: string; subject: string; html: string; text?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
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

async function deliver(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) return { ok: false, error: `provider ${res.status}` };
  return { ok: true };
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
