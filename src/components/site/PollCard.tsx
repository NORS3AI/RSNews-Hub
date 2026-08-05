'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check } from '@/components/icons';

export type PollOption = { id: string; label: string; votes: number };
export type PollData = { id: string; question: string; closesAt?: string | Date | null; options: PollOption[] };

/**
 * Reader poll with live results. Voting requires a logged-in account and is
 * limited to one vote per account (enforced server-side). The tallies animate
 * in immediately after voting; closed polls and already-voted polls show
 * results read-only. "View latest polls" links to the polls archive.
 */
// Compact "time remaining" label, e.g. "2d 5h", "5h", "12m".
function fmtLeft(ms: number): string {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${Math.max(1, mm)}m`;
}

// Distinct slice colors for the pie view (brand-forward, theme-agnostic).
const PIE_COLORS = ['#E97D34', '#3d6a8f', '#7a9e5b', '#c65b52', '#8a6fb0', '#d1a24a', '#5aa0a0', '#9c6b4a'];

function Pie({ options, total }: { options: PollOption[]; total: number }) {
  if (total <= 0) return null;
  const R = 52, C = 60, cir = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90">
        {options.map((o, i) => {
          const frac = o.votes / total;
          const dash = frac * cir;
          const el = (
            <circle key={o.id} cx={C} cy={C} r={R} fill="none" stroke={PIE_COLORS[i % PIE_COLORS.length]}
              strokeWidth={16} strokeDasharray={`${dash} ${cir - dash}`} strokeDashoffset={-offset} />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
            <span className="shrink-0 font-extrabold tabular-nums">{total ? Math.round((o.votes / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PollCard({ poll, loggedIn, votedOptionId = null, chart = 'bar' }: { poll: PollData; loggedIn: boolean; votedOptionId?: string | null; chart?: 'bar' | 'pie' }) {
  const [opts, setOpts] = useState<PollOption[]>(poll.options);
  const [choice, setChoice] = useState<string | null>(votedOptionId);
  const [busy, setBusy] = useState(false);

  const closed = !!poll.closesAt && new Date(poll.closesAt) < new Date();
  const msLeft = poll.closesAt ? new Date(poll.closesAt).getTime() - Date.now() : 0;
  const closesIn = !closed && msLeft > 0 ? fmtLeft(msLeft) : '';
  const total = opts.reduce((n, o) => n + o.votes, 0);
  const voted = choice !== null || closed;
  const canVote = loggedIn && !voted;

  async function vote(optionId: string) {
    if (!canVote || busy) return;
    setBusy(true);
    // optimistic
    setOpts((prev) => prev.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)));
    setChoice(optionId);
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId }),
      });
      if (res.ok) { const data = await res.json(); if (Array.isArray(data.options)) setOpts(data.options); }
    } catch {}
    setBusy(false);
  }

  return (
    <section className="module flex h-full flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.1em] text-white">Poll</span>
        <span className="text-sm font-semibold text-[var(--muted)]">Reader poll of the month</span>
        {closesIn && <span className="ml-auto whitespace-nowrap rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-xs font-bold text-brand-700 dark:text-brand-300" title="Time remaining">⏱ {closesIn} left</span>}
      </div>
      <h2 className="mb-4 text-2xl font-black leading-tight tracking-tight">{poll.question}</h2>

      {voted && chart === 'pie' ? (
        <Pie options={opts} total={total} />
      ) : (
        <div className="space-y-2.5">
          {opts.map((o) => {
            const pct = total ? Math.round((o.votes / total) * 100) : 0;
            const mine = choice === o.id;
            if (!voted) {
              // Logged in → vote. Logged out → the row routes to the login wall.
              const cls = 'flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-left font-bold transition hover:border-brand-400 hover:bg-[var(--bg-soft)] disabled:opacity-60';
              return loggedIn ? (
                <button key={o.id} onClick={() => vote(o.id)} disabled={busy} className={cls}>{o.label}</button>
              ) : (
                <Link key={o.id} href="/login" className={cls}>{o.label}</Link>
              );
            }
            return (
              <div key={o.id} className="relative overflow-hidden rounded-xl border border-[var(--border)] px-4 py-3">
                <div className="absolute inset-y-0 left-0 bg-brand-600/15" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-bold">{mine && <Check width={15} height={15} className="text-brand-600" />}{o.label}</span>
                  <span className="shrink-0 text-sm font-extrabold text-brand-700 dark:text-brand-300">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>
          {total.toLocaleString()} vote{total === 1 ? '' : 's'}
          {closed ? ' · closed' : voted ? ' · thanks for voting!' : !loggedIn ? ' · sign in to vote' : ''}
        </span>
      </div>

      <Link href="/docs/archive/polls" className="btn-outline btn-sm mt-4 w-full justify-center">View latest polls</Link>
    </section>
  );
}
