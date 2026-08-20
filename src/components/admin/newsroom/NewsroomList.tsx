'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createNewsroomDoc } from '@/lib/actions';
import type { NewsroomDocSummary } from '@/lib/newsroom';
import { Plus, FileText } from '@/components/icons';

type Me = { id: string; name: string };
type MyArticle = { id: string; title: string; status: string; updatedAt: string; publishedAt: string | null };
type Sort = 'edited' | 'created' | 'title';

function fmtDate(iso: string, mounted: boolean): string {
  if (!mounted) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

const SORTS: { value: Sort; label: string }[] = [
  { value: 'edited', label: 'Recently edited' },
  { value: 'created', label: 'Recently created' },
  { value: 'title', label: 'Title A–Z' },
];

export default function NewsroomList({ drafts, myArticles, me }: { drafts: NewsroomDocSummary[]; myArticles: MyArticle[]; me: Me }) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [sort, setSort] = useState<Sort>('edited');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const sortedDrafts = useMemo(() => {
    const arr = [...drafts];
    if (sort === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'created') arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return arr;
  }, [drafts, sort]);

  const newDraft = () => startBusy(async () => {
    const id = await createNewsroomDoc();
    router.push(`/admin/newsroom/${id}`);
  });

  return (
    <div className="space-y-8">
      {/* Drafts */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Shared drafts <span className="text-sm font-normal text-[var(--muted)]">({drafts.length})</span></h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted)]" htmlFor="nr-sort">Sort</label>
            <select id="nr-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input h-8 py-0 text-sm">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={newDraft}><Plus width={14} height={14} /> New draft</button>
          </div>
        </div>

        {sortedDrafts.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
            <FileText width={26} height={26} className="text-[var(--muted)]" />
            <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">No drafts yet. Start one and anyone with admin can write alongside you.</p>
            <button type="button" className="btn-primary btn-sm mt-3" disabled={busy} onClick={newDraft}><Plus width={14} height={14} /> New draft</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            {sortedDrafts.map((d, i) => (
              <Link key={d.id} href={`/admin/newsroom/${d.id}`}
                className={`flex items-center gap-4 bg-[var(--card)] px-4 py-3 hover:bg-[var(--bg-soft)] ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{d.title || 'Untitled draft'}</div>
                  <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {d.createdByName ? <>Started by <b className="font-semibold text-[var(--fg)]">{d.createdByName}</b></> : 'Shared draft'}
                    {d.commentCount > 0 && <> · {d.commentCount} note{d.commentCount === 1 ? '' : 's'}</>}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-[var(--muted)]">
                  <div>edited {fmtDate(d.updatedAt, mounted)}</div>
                  {d.updatedByName && <div className="text-[11px]">by {d.updatedByName}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* My articles */}
      <section>
        <h2 className="mb-3 text-lg font-bold">My articles <span className="text-sm font-normal text-[var(--muted)]">({myArticles.length})</span></h2>
        {myArticles.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">You haven&apos;t authored any articles yet. Push a draft to the article editor to start one.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            {myArticles.map((a, i) => (
              <Link key={a.id} href={`/admin/articles/${a.id}`}
                className={`flex items-center gap-4 bg-[var(--card)] px-4 py-3 hover:bg-[var(--bg-soft)] ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className="min-w-0 flex-1 truncate font-semibold">{a.title || 'Untitled'}</div>
                <span className={`badge shrink-0 text-[10px] uppercase tracking-wide ${a.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : a.status === 'DRAFT' ? 'bg-[var(--bg-soft)] text-[var(--muted)]' : 'bg-amber-100 text-amber-800'}`}>{a.status.toLowerCase()}</span>
                <div className="w-24 shrink-0 text-right text-xs text-[var(--muted)]">{fmtDate(a.publishedAt ?? a.updatedAt, mounted)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
