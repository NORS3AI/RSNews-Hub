// Structured server logging + ONE error-capture chokepoint. Never logs secrets.
//
// `captureError` always emits a structured log line and then calls an optional
// forwarder. To send errors to Sentry (or any tool), install its SDK and add a
// single line in its init file — no changes at the (already-wired) call sites:
//
//   import * as Sentry from '@sentry/nextjs';
//   import { setErrorForwarder } from '@/lib/logger';
//   setErrorForwarder((e, ctx) => Sentry.captureException(e, { extra: ctx }));
//
// This keeps the app dependency-free and tool-agnostic while making activation
// a one-liner. See DEPLOYMENT.md.

type Level = 'info' | 'warn' | 'error';
type Ctx = Record<string, unknown>;

function emit(level: Level, msg: string, ctx?: Ctx) {
  const record = { level, msg, ...ctx, ts: new Date().toISOString() };
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  try { out(JSON.stringify(record)); } catch { out(`[${level}] ${msg}`); }
}

export const log = {
  info: (msg: string, ctx?: Ctx) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Ctx) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Ctx) => emit('error', msg, ctx),
};

type Forwarder = (err: Error, ctx?: Ctx) => void;
let forwarder: Forwarder | null = null;

/** Register an error sink (e.g. Sentry). Call once at startup. */
export function setErrorForwarder(fn: Forwarder | null): void { forwarder = fn; }

export function isErrorForwarderSet(): boolean { return forwarder !== null; }

/** Log an error with structured context and forward it to the sink if set. */
export function captureError(err: unknown, ctx?: Ctx): void {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error');
  emit('error', e.message, { ...ctx, stack: e.stack });
  if (forwarder) { try { forwarder(e, ctx); } catch { /* never let logging throw */ } }
}
