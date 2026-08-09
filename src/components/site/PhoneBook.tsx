'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addSavedSupplier, removeSavedSupplier } from '@/lib/actions';
import { Star, StarFilled, Mail, ChevronRight } from '@/components/icons';

type Supplier = {
  id: string; name: string; brandKey: string; premium: boolean;
  website: string | null; supplierUrl: string | null; phone: string | null;
  contactEmail: string | null; blurb: string | null; logoUrl: string | null;
};
type Entry = { vendor: Supplier; note: string | null; altEmail: string | null; altPhone: string | null };

export default function PhoneBook({ entries, directory }: { entries: Entry[]; directory: Supplier[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<'book' | 'directory'>(entries.length ? 'book' : 'directory');
  const savedIds = new Set(entries.map((e) => e.vendor.id));
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="module">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold"><StarFilled className="text-brand-600" width={20} height={20} /> Suppliers</h1>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] text-sm font-semibold">
          {(['book', 'directory'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 ${tab === t ? 'bg-brand-600 text-white' : 'bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
              {t === 'book' ? `My phone book${entries.length ? ` (${entries.length})` : ''}` : 'Directory'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'book' ? (
        entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Your phone book is empty. Open the <button onClick={() => setTab('directory')} className="font-semibold text-brand-600 hover:underline">Directory</button> and star a supplier to add them here — then open them to keep notes and an alternate contact.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <Link key={e.vendor.id} href={`/docs/suppliers/${e.vendor.id}`}
                className="tile flex items-center gap-3 p-4 transition hover:border-brand-400">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{e.vendor.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--muted)]">
                    {e.vendor.phone && <span>📞 {e.vendor.phone}</span>}
                    {e.vendor.contactEmail && <span className="inline-flex items-center gap-1"><Mail width={12} height={12} />{e.vendor.contactEmail}</span>}
                    {(e.note || e.altEmail || e.altPhone) && <span className="text-brand-600">• your notes</span>}
                  </div>
                </div>
                <ChevronRight width={18} height={18} className="shrink-0 text-[var(--muted)]" />
              </Link>
            ))}
          </div>
        )
      ) : (
        directory.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No premium suppliers listed yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {directory.map((v) => {
              const on = savedIds.has(v.id);
              return (
                <div key={v.id} className="tile flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/docs/suppliers/${v.id}`} className="font-bold hover:text-brand-600 hover:underline">{v.name}</Link>
                    {v.blurb && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">{v.blurb}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                      {v.phone && <span>{v.phone}</span>}
                      {v.contactEmail && <span className="inline-flex items-center gap-1"><Mail width={12} height={12} />{v.contactEmail}</span>}
                    </div>
                  </div>
                  <button onClick={() => run(() => on ? removeSavedSupplier(v.id) : addSavedSupplier(v.id))} disabled={pending}
                    title={on ? 'In your phone book' : 'Add to phone book'} aria-pressed={on}
                    className={`shrink-0 rounded-full border p-2 transition ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-[var(--border)] text-[var(--muted)] hover:text-brand-600'}`}>
                    {on ? <StarFilled width={16} height={16} /> : <Star width={16} height={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
