'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Countdown from './Countdown';
import { X } from '@/components/icons';
import type { AnnouncementRecord } from '@/lib/announcement';

// Dismissible top strip. `sig` is a signature of the visible content — when the
// admin edits the live message (or switches which one is live), it changes, so a
// reader who dismissed the old one sees the new. Dismissal is per-signature in
// localStorage (client-only). Size, element order and the optional message
// ticker all come from the record.
const DISMISS_KEY = 'rsnews_ann_dismissed';

const SIZE: Record<string, string> = {
  sm: 'py-1.5 text-sm',
  md: 'py-2.5 text-[15px]',
  lg: 'py-3.5 text-base sm:text-lg',
};

export default function AnnouncementBar({ record, sig }: { record: AnnouncementRecord; sig: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!record.message) return;
    let dismissed = '';
    try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch { /* ignore */ }
    setShow(dismissed !== sig);
  }, [record.message, sig]);

  if (!record.message || !show) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, sig); } catch { /* ignore */ }
    setShow(false);
  }

  // Build each element; render them in the admin-chosen order, skipping empties.
  const messageEl = record.ticker ? (
    <div key="message" className="min-w-0 flex-1 overflow-hidden">
      {/* Two copies scroll seamlessly; reduced-motion users get it static. */}
      <div className="ann-marquee font-semibold">
        <span>{record.message}</span>
        <span aria-hidden className="pl-16">{record.message}</span>
      </div>
    </div>
  ) : (
    <span key="message" className="font-semibold">{record.message}</span>
  );

  const countdownEl = record.showCountdown && record.targetAt ? (
    <span key="countdown" className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5"><Countdown target={record.targetAt} variant="bar" /></span>
  ) : null;

  const buttonEl = record.href ? (
    <Link key="button" href={record.href} className="shrink-0 rounded-full bg-white px-3 py-0.5 font-bold text-brand-700 hover:bg-white/90">{record.hrefLabel || 'Learn more'} →</Link>
  ) : null;

  const byKey: Record<string, React.ReactNode> = { message: messageEl, countdown: countdownEl, button: buttonEl };
  const ordered = record.order.map((k) => byKey[k]).filter(Boolean);

  return (
    <div className={`relative bg-brand-600 px-4 text-white ${SIZE[record.size] ?? SIZE.md}`}>
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-x-3 gap-y-1 pr-7 flex-wrap">
        <span aria-hidden className="shrink-0">📣</span>
        {ordered}
      </div>
      <button onClick={dismiss} aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white">
        <X width={16} height={16} />
      </button>
    </div>
  );
}
