'use client';
import type { ClientEvent } from './types';

// Lightweight client tracker: queues events and flushes them in batches (via
// sendBeacon on page-hide) so a page render never waits on analytics.

let queue: ClientEvent[] = [];
let sessionId = '';
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getSession(): string {
  if (sessionId) return sessionId;
  try {
    let s = sessionStorage.getItem('rsnews_sid');
    if (!s) { s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); sessionStorage.setItem('rsnews_sid', s); }
    sessionId = s;
  } catch { sessionId = 'nosession'; }
  return sessionId;
}

export function track(ev: ClientEvent): void {
  if (typeof window === 'undefined') return;
  queue.push({ ...ev, sessionId: ev.sessionId || getSession(), path: ev.path || location.pathname });
  if (queue.length >= 20) { flush(); return; }
  if (!flushTimer) flushTimer = setTimeout(() => flush(), 2500);
}

export function flush(useBeacon = false): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!queue.length) return;
  const batch = queue; queue = [];
  const body = JSON.stringify({ events: batch });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/collect', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* swallow — analytics must never break the page */ }
}

export function sessionIdOf(): string { return getSession(); }
