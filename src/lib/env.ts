// Centralized, validated environment access. The goal: misconfiguration fails
// loudly (and only) at runtime in production — never a silent insecure default,
// and never a thrown error during `next build` (which has no secrets set).

const DEV_AUTH_SECRET = 'rsnews-hub-dev-secret-change-in-production-please-0000';
const PLACEHOLDER_SECRETS = new Set([DEV_AUTH_SECRET, 'change-me-to-a-long-random-string', '']);

export const isProd = process.env.NODE_ENV === 'production';
const inProduction = () => process.env.NODE_ENV === 'production';

function secretIsWeak(v: string | undefined): boolean {
  return !v || PLACEHOLDER_SECRETS.has(v) || v.length < 24;
}

/**
 * The JWT signing secret, as bytes. In production a missing/placeholder/short
 * secret throws (sessions would be forgeable); in dev it falls back to a fixed
 * dev value. Evaluated lazily at request time, so `next build` never trips it.
 */
export function getAuthSecret(): Uint8Array {
  const v = process.env.AUTH_SECRET;
  if (secretIsWeak(v)) {
    if (inProduction()) throw new Error('AUTH_SECRET must be set to a strong, unique value in production. Generate one with:  openssl rand -base64 48');
    return new TextEncoder().encode(DEV_AUTH_SECRET);
  }
  return new TextEncoder().encode(v!);
}

export const siteUrl = process.env.SITE_URL || '';

/**
 * Non-throwing config report for the health check / a startup log. Lets ops see
 * what's misconfigured without taking the process down.
 */
export function envReport() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL ? 'set' : 'MISSING',
    databaseKind: (process.env.DATABASE_URL || '').startsWith('postgres') ? 'postgres' : (process.env.DATABASE_URL || '').startsWith('file:') ? 'sqlite' : 'unknown',
    authSecret: secretIsWeak(process.env.AUTH_SECRET) ? (inProduction() ? 'WEAK (must fix)' : 'dev-default') : 'set',
    siteUrl: siteUrl || 'unset',
    email: process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? 'configured' : 'log-only',
    errorTracking: process.env.SENTRY_DSN ? 'sentry' : 'logs-only',
    storage: process.env.STORAGE_DRIVER === 's3' || (process.env.STORAGE_DRIVER !== 'local' && process.env.S3_BUCKET) ? 's3' : 'local',
    imageOptimize: process.env.IMAGE_OPTIMIZE === 'false' ? 'off' : `on (${(process.env.IMAGE_FORMAT || 'webp')}, max ${process.env.IMAGE_MAX_DIM || '2000'}px)`,
    authMode: (() => { const m = (process.env.AUTH_MODE || 'local').toLowerCase(); return m === 'jwt' || m === 'header' ? m : 'local'; })(),
  };
}
