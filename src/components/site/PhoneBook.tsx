'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addSavedSupplier, removeSavedSupplier, updateSavedSupplier } from '@/lib/actions';
import { Star, StarFilled, Mail, LinkIcon, Check } from '@/components/icons';

type Supplier = {
  id: string; name: string; brandKey: string; slug: string; premium: boolean;
  website: string | null; phone: string | null; contactEmail: string | null; blurb: string | null; logoUrl: string | null;
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
          <p className="text-sm text-[var(--muted)]">Your phone book is empty. Open the <button onClick={() => setTab('directory')} className="font-semibold text-brand-600 hover:underline">Directory</button> and star a supplier to add them here — with room for your own notes and an alternate contact.</p>
        ) : (
          <div className="space-y-4">
            {entries.map((e) => <BookCard key={e.vendor.id} entry={e} pending={pending} run={run} />)}
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
                    <Link href={`/docs/supplier/${v.slug}`} className="font-bold hover:text-brand-600 hover:underline">{v.name}</Link>
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

function BookCard({ entry, pending, run }: { entry: Entry; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const v = entry.vendor;
  const [note, setNote] = useState(entry.note ?? '');
  const [altEmail, setAltEmail] = useState(entry.altEmail ?? '');
  const [altPhone, setAltPhone] = useState(entry.altPhone ?? '');
  const [saved, setSaved] = useState(false);
  const dirty = note !== (entry.note ?? '') || altEmail !== (entry.altEmail ?? '') || altPhone !== (entry.altPhone ?? '');

  return (
    <div className="tile p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/docs/supplier/${v.slug}`} className="text-lg font-bold hover:text-brand-600 hover:underline">{v.name}</Link>
          {/* Official contact from the vendor record. */}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            {v.phone && <span>📞 {v.phone}</span>}
            {v.contactEmail && <a href={`mailto:${v.contactEmail}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Mail width={13} height={13} />{v.contactEmail}</a>}
            {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600"><LinkIcon width={13} height={13} />Website</a>}
          </div>
        </div>
        <button onClick={() => run(() => removeSavedSupplier(v.id))} disabled={pending}
          title="Remove from phone book" className="shrink-0 rounded-full border border-brand-500 bg-brand-500 p-2 text-white">
          <StarFilled width={16} height={16} />
        </button>
      </div>

      {/* Reader's own additions — clearly separated from the official contact. */}
      <div className="mt-3 space-y-2 rounded-lg border border-dashed border-[var(--border)] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Your notes &amp; contacts <span className="font-normal normal-case">(added by you — not official)</span></div>
        <textarea value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} rows={2} placeholder="Notes (rep name, account #, reminders…)" className="input text-sm" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={altEmail} onChange={(e) => { setAltEmail(e.target.value); setSaved(false); }} placeholder="Alt. email" className="input text-sm" />
          <input value={altPhone} onChange={(e) => { setAltPhone(e.target.value); setSaved(false); }} placeholder="Alt. phone" className="input text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <button disabled={pending || !dirty} onClick={() => run(async () => { await updateSavedSupplier(v.id, { note, altEmail, altPhone }); setSaved(true); })}
            className="btn-outline btn-sm disabled:opacity-40">{saved && !dirty ? <><Check width={13} height={13} /> Saved</> : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
