'use client';
import { useEffect, useState } from 'react';

// Live countdown to an ISO instant. Two looks:
//   • 'big'  — large boxed Days / Hours / Mins / Secs (the module element)
//   • 'bar'  — one compact line "12d 03h 45m 10s" (the top strip)
// Pre-mount it renders dashes so server and client markup match (no hydration
// mismatch and no layout jump), then ticks each second on the client.

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: ms <= 0 };
}
const pad = (n: number) => String(n).padStart(2, '0');

export default function Countdown({ target, variant = 'big', doneLabel = "It's here!" }: { target: string; variant?: 'big' | 'bar'; doneLabel?: string }) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (isNaN(targetMs)) return null;

  const t = now === null ? null : split(targetMs - now);

  if (variant === 'bar') {
    if (t?.done) return <span className="font-extrabold">{doneLabel}</span>;
    return (
      <span className="tabular-nums font-extrabold tracking-tight" suppressHydrationWarning>
        {t ? `${t.d}d ${pad(t.h)}h ${pad(t.m)}m ${pad(t.s)}s` : '—d —h —m —s'}
      </span>
    );
  }

  // 'big'
  if (t?.done) {
    return <div className="text-center text-3xl font-black text-brand-600 sm:text-4xl">{doneLabel}</div>;
  }
  const cells: [string, string][] = [
    ['Days', t ? String(t.d) : '—'],
    ['Hours', t ? pad(t.h) : '—'],
    ['Minutes', t ? pad(t.m) : '—'],
    ['Seconds', t ? pad(t.s) : '—'],
  ];
  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2.5 sm:gap-4" suppressHydrationWarning>
      {cells.map(([label, val]) => (
        <div key={label} className="min-w-[68px] rounded-2xl bg-brand-600 px-3 py-3 text-center text-white shadow-[var(--shadow-card)] sm:min-w-[92px] sm:px-5 sm:py-4">
          <div className="tabular-nums text-3xl font-black leading-none sm:text-5xl">{val}</div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80 sm:text-xs">{label}</div>
        </div>
      ))}
    </div>
  );
}
