'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Countdown from './Countdown';
import { X } from '@/components/icons';
import type { AnnouncementConfig } from '@/lib/announcement';

// Dismissible top strip. The `sig` is a signature of the visible content — when
// the admin changes the message/date, it changes, so a reader who dismissed the
// old announcement sees the new one. Dismissal is remembered per-signature in
// localStorage (client-only, no account needed).
const DISMISS_KEY = 'rsnews_ann_dismissed';

export default function AnnouncementBar({ config, sig }: { config: AnnouncementConfig; sig: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!config.enabled || !config.message) return;
    let dismissed = '';
    try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch { /* ignore */ }
    setShow(dismissed !== sig);
  }, [config.enabled, config.message, sig]);

  if (!config.enabled || !config.message || !show) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, sig); } catch { /* ignore */ }
    setShow(false);
  }

  const linkLabel = config.hrefLabel || 'Learn more';
  return (
    <div className="relative bg-brand-600 px-4 py-2 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-x-3 gap-y-1 pr-7 text-sm flex-wrap">
        <span aria-hidden>📣</span>
        <span className="font-semibold">{config.message}</span>
        {config.showCountdown && config.targetAt && (
          <span className="rounded-full bg-white/15 px-2.5 py-0.5"><Countdown target={config.targetAt} variant="bar" /></span>
        )}
        {config.href && (
          <Link href={config.href} className="rounded-full bg-white px-3 py-0.5 font-bold text-brand-700 hover:bg-white/90">{linkLabel} →</Link>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white">
        <X width={16} height={16} />
      </button>
    </div>
  );
}
