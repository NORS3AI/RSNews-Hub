'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSectionSpan } from '@/lib/actions';

// Width wrapper for the two pinned top sections (Hero, "Published this week").
// They aren't in the module layout, so their width is stored as its own Setting.
// Only Full (3) or ⅔ (2) — ⅓ is deliberately locked out — and a ⅔ section just
// leaves the remaining third open (per the product decision). Below lg both
// collapse to full width. Staff see a small hover toggle; readers just see the
// width.
export default function SectionWidth({ spanKey, span, isAdmin, children }: {
  spanKey: string; span: number; isAdmin: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const widthClass = span === 2 ? 'lg:w-2/3' : 'w-full';

  if (!isAdmin) return <div className={widthClass}>{children}</div>;

  const set = (n: number) => start(async () => { await setSectionSpan(spanKey, n); router.refresh(); });
  return (
    <div className={`group relative ${widthClass}`}>
      {children}
      <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        {([[3, 'Full'], [2, '⅔']] as const).map(([n, label]) => (
          <button key={n} type="button" disabled={pending} onClick={() => set(n)}
            title={n === 3 ? 'Full width' : 'Two-thirds — leaves the last third open'}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-card transition disabled:opacity-50 ${span === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:border-brand-400 hover:text-brand-600'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
