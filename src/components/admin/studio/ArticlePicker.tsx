'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, Check, X } from '@/components/icons';

type Hit = { id: string; title: string; slug: string };

// Typeahead to hand-pick a specific published article for an article block.
export default function ArticlePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [label, setLabel] = useState<string>('');
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the current selection's title (e.g. when reopening a saved block).
  useEffect(() => {
    if (!value) { setLabel(''); return; }
    let alive = true;
    fetch(`/api/admin/articles/search?id=${encodeURIComponent(value)}`)
      .then((r) => r.json()).then((d) => { if (alive) setLabel(d.articles?.[0]?.title ?? '(article not found)'); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value]);

  function search(text: string) {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/articles/search?q=${encodeURIComponent(text)}`);
        const d = await r.json();
        setHits(d.articles ?? []);
        setOpen(true);
      } catch { /* ignore */ }
    }, 200);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-3 py-2 text-sm">
        <Check width={14} height={14} className="shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1 truncate font-semibold">{label || '…'}</span>
        <button onClick={() => { onChange(''); setQ(''); setHits([]); }} className="shrink-0 text-[var(--muted)] hover:text-[var(--fg)]" aria-label="Clear"><X width={14} height={14} /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"><Search width={14} height={14} /></span>
        <input className="input pl-8" value={q} placeholder="Search articles…" onChange={(e) => search(e.target.value)} onFocus={() => hits.length && setOpen(true)} />
      </div>
      {open && hits.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
          {hits.map((h) => (
            <li key={h.id}>
              <button onClick={() => { onChange(h.id); setOpen(false); }} className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-[var(--bg-soft)]">{h.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
