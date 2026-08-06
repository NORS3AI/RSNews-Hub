'use client';
import { useState } from 'react';
import Link from 'next/link';
import StatusChip from './StatusChip';
import type { LifeStatus } from '@/lib/contentStatus';
import { FileText, BarChart, Check, Grid } from '@/components/icons';

export type ActivityType = 'article' | 'poll' | 'quiz' | 'module';
export type ActivityItem = { id: string; type: ActivityType; title: string; status: LifeStatus; at: string; href: string };

const TYPES: { key: ActivityType; label: string; icon: typeof FileText }[] = [
  { key: 'article', label: 'Articles', icon: FileText },
  { key: 'poll', label: 'Polls', icon: BarChart },
  { key: 'quiz', label: 'Quizzes', icon: Check },
  { key: 'module', label: 'Modules', icon: Grid },
];
const ICON: Record<ActivityType, typeof FileText> = { article: FileText, poll: BarChart, quiz: Check, module: Grid };

export default function ActivityList({ items }: { items: ActivityItem[] }) {
  // All types on by default; toggle a chip to narrow (e.g. just articles + polls).
  const [on, setOn] = useState<Record<ActivityType, boolean>>({ article: true, poll: true, quiz: true, module: true });
  const toggle = (k: ActivityType) => setOn((s) => ({ ...s, [k]: !s[k] }));
  const allOn = TYPES.every((t) => on[t.key]);
  const setAll = (v: boolean) => setOn({ article: v, poll: v, quiz: v, module: v });

  const shown = items.filter((i) => on[i.type]);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      {/* Type filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setAll(true)} disabled={allOn}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${allOn ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
          All
        </button>
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = on[t.key];
          const count = items.filter((i) => i.type === t.key).length;
          return (
            <button key={t.key} onClick={() => toggle(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${active ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
              <Icon width={14} height={14} /> {t.label} <span className="text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-card">
        {shown.map((i) => {
          const Icon = ICON[i.type];
          return (
            <li key={`${i.type}-${i.id}`}>
              <Link href={i.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--card-2)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--card-2)] text-[var(--muted)]"><Icon width={15} height={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{i.title}</span>
                  <span className="text-xs capitalize text-[var(--muted)]">{i.type} · {fmt(i.at)}</span>
                </span>
                <StatusChip status={i.status} />
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            {items.length === 0 ? 'Nothing created yet.' : 'No items match the selected types.'}
          </li>
        )}
      </ul>
    </div>
  );
}
