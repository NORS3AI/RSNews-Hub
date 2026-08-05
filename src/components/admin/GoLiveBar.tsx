'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishHomeLayout, discardHomeDraft } from '@/lib/actions';
import { Check } from '@/components/icons';

// Staging banner for the homepage layout: shows when the draft differs from what
// is live, with Go Live (publish) and Discard (revert to live) actions.
export default function GoLiveBar({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  if (!pending) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--muted)] shadow-card">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        The homepage is up to date — no pending changes.
      </div>
    );
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-card dark:border-amber-900/60 dark:bg-amber-950/30">
      <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        You have unpublished homepage changes — they aren&apos;t live yet.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button disabled={busy} onClick={() => run(discardHomeDraft)} className="btn-outline btn-sm">Discard</button>
        <button disabled={busy} onClick={() => run(publishHomeLayout)} className="btn-primary btn-sm">
          {busy ? 'Publishing…' : <><Check width={14} height={14} /> Go Live</>}
        </button>
      </div>
    </div>
  );
}
