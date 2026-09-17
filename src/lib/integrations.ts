import { prisma } from './db';
import { storageMode } from './storage';
import { isErrorForwarderSet } from './logger';

// Health of the hub's external connections, for the admin Integrations panel.
// Each check reports one of:
//   ok           — configured AND responding
//   down         — configured but the live check failed (bad key / service down)
//   unconfigured — not set up (env vars missing); nothing to do
//   inbound      — a service that calls US (JotForm) — shown via last activity,
//                  not a live ping
export type IntegrationStatus = 'ok' | 'down' | 'unconfigured' | 'inbound';
export type IntegrationResult = { key: string; label: string; detail: string; status: IntegrationStatus; message: string };

// A bounded outbound health ping (never throws; times out).
async function ping(url: string, headers: Record<string, string>, ms = 6000): Promise<{ ok: boolean; status: number; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error)?.name === 'AbortError' ? 'timed out' : (e as Error)?.message };
  } finally { clearTimeout(timer); }
}

const ago = (d: Date): string => {
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (h < 1) return 'under an hour ago';
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

async function checkElevenLabs(): Promise<IntegrationResult> {
  const base = { key: 'elevenlabs', label: 'ElevenLabs', detail: 'Text-to-speech for the "Listen to article" audio.' };
  const key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return { ...base, status: 'unconfigured', message: !key ? 'No API key set.' : 'API key set, but no voice chosen.' };
  const r = await ping('https://api.elevenlabs.io/v1/user', { 'xi-api-key': key });
  return { ...base, status: r.ok ? 'ok' : 'down', message: r.ok ? 'Responding.' : `Not responding (${r.error || 'HTTP ' + r.status}).` };
}

async function checkEmail(): Promise<IntegrationResult> {
  const base = { key: 'email', label: 'Email', detail: 'Transactional + newsletter delivery.' };
  const from = process.env.EMAIL_FROM;
  const resend = process.env.RESEND_API_KEY, sendgrid = process.env.SENDGRID_API_KEY;
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase() === 'sendgrid' && sendgrid ? 'sendgrid'
    : resend ? 'resend' : sendgrid ? 'sendgrid' : null;
  if (!from || !provider) return { ...base, status: 'unconfigured', message: 'No sender / provider key set — emails are logged, not sent.' };
  const r = provider === 'resend'
    ? await ping('https://api.resend.com/domains', { authorization: `Bearer ${resend}` })
    : await ping('https://api.sendgrid.com/v3/scopes', { authorization: `Bearer ${sendgrid}` });
  return { ...base, status: r.ok ? 'ok' : 'down', message: r.ok ? `${provider} responding.` : `${provider} not responding (${r.error || 'HTTP ' + r.status}).` };
}

function checkStorage(): IntegrationResult {
  const base = { key: 'storage', label: 'Storage', detail: 'Where uploaded images + generated audio live.' };
  if (storageMode() === 's3') return { ...base, status: 'ok', message: `AWS S3 / R2 bucket: ${process.env.S3_BUCKET}.` };
  return { ...base, status: 'ok', message: 'Local disk — fine for dev, but files vanish on redeploy. Set S3_* for production.' };
}

async function checkJotform(): Promise<IntegrationResult> {
  const base = { key: 'jotform', label: 'JotForm (ad orders)', detail: 'Inbound ad-order submissions (they call us — no live ping).' };
  if (!process.env.JOTFORM_WEBHOOK_SECRET) return { ...base, status: 'unconfigured', message: 'No webhook secret set.' };
  const last = await prisma.adSubmission.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  return { ...base, status: 'inbound', message: last ? `Last submission ${ago(last.createdAt)}.` : 'Configured — no submissions received yet.' };
}

async function checkContentIntake(): Promise<IntegrationResult> {
  const base = { key: 'content_intake', label: 'JotForm (sponsored content)', detail: 'Inbound sponsored-article submissions → draft articles (they call us — no live ping).' };
  if (!process.env.JOTFORM_WEBHOOK_SECRET) return { ...base, status: 'unconfigured', message: 'No webhook secret set.' };
  const last = await prisma.contentSubmission.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  return { ...base, status: 'inbound', message: last ? `Last submission ${ago(last.createdAt)}.` : 'Configured — no submissions received yet.' };
}

async function checkDatabase(): Promise<IntegrationResult> {
  const base = { key: 'database', label: 'Database', detail: 'The hub\'s primary data store.' };
  try { await prisma.$queryRaw`SELECT 1`; return { ...base, status: 'ok', message: 'Responding.' }; }
  catch (e) { return { ...base, status: 'down', message: `Query failed (${(e as Error)?.message?.slice(0, 80)}).` }; }
}

function checkSentry(): IntegrationResult {
  const base = { key: 'sentry', label: 'Sentry', detail: 'Error tracking (optional; errors also go to logs).' };
  // Honest check: a DSN env var alone does nothing. Errors only reach Sentry when
  // the SDK is installed AND an error forwarder is registered (see
  // logger.setErrorForwarder). Report "ok" only when that forwarder is live —
  // never off a stray env var.
  if (isErrorForwarderSet()) return { ...base, status: 'ok', message: 'Wired — errors are being forwarded.' };
  if (process.env.SENTRY_DSN) return { ...base, status: 'unconfigured', message: 'DSN set, but the SDK isn’t wired up — errors go to logs only.' };
  return { ...base, status: 'unconfigured', message: 'Not set up — errors go to logs only.' };
}

/** Run every integration check (in parallel) for the admin panel. */
export async function checkIntegrations(): Promise<IntegrationResult[]> {
  return Promise.all([
    checkDatabase(), checkStorage(), Promise.resolve(checkSentry()),
    checkEmail(), checkElevenLabs(), checkJotform(), checkContentIntake(),
  ]);
}
