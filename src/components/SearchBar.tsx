'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from './icons';

type Result = { id: string; title: string; slug: string; category: { name: string } | null };

export default function SearchBar({ big = false }: { big?: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) { setOpen(false); router.push(`/docs/search?q=${encodeURIComponent(q.trim())}`); }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"><Search width={18} height={18} /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search articles…"
            className={`input pl-10 ${big ? 'h-12 text-base' : 'h-10'}`}
            aria-label="Smart search"
          />
        </div>
      </form>
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
          {loading && !results.length && <div className="px-4 py-3 text-sm text-[var(--muted)]">Searching…</div>}
          {results.map((r) => (
            <Link key={r.id} href={`/docs/article/${r.slug}`} onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-[var(--bg-soft)]">
              <span className="line-clamp-1 font-medium">{r.title}</span>
              {r.category && <span className="shrink-0 text-xs text-[var(--muted)]">{r.category.name}</span>}
            </Link>
          ))}
          {q.trim() && (
            <button onClick={submit} className="w-full border-t border-[var(--border)] px-4 py-2.5 text-left text-sm text-brand-600 hover:bg-[var(--bg-soft)]">
              See all results for “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
