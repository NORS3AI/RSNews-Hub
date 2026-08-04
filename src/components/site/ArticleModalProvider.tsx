'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, Clock, Eye, ArrowRight, Tag as TagIcon } from '@/components/icons';
import { formatDate } from '@/lib/utils';
import AdSlot from '@/components/AdSlot';
import StarButton from './StarButton';
import { useSaved } from './StarProvider';

type ModalArticle = {
  id: string; title: string; slug: string; content: string; coverImage: string | null;
  status: string; readMinutes: number; views: number; publishedAt: string | null;
  author: { name: string } | null;
  category: { name: string; slug: string; color: string } | null;
  tags: { name: string; slug: string }[];
};
type Related = { id: string; title: string; slug: string; category: { name: string; color: string } | null };
type Payload = { article: ModalArticle; related: Related[]; next: { title: string; slug: string } | null };

type Ctx = { openArticle: (slug: string) => void; close: () => void };
const ModalCtx = createContext<Ctx | null>(null);

export function useArticleModal() {
  const ctx = useContext(ModalCtx);
  if (!ctx) throw new Error('useArticleModal must be used within ArticleModalProvider');
  return ctx;
}

export function ArticleModalProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { recordHistory } = useSaved();

  const load = useCallback(async (s: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/articles/${s}`, { signal: ctrl.signal });
      if (!res.ok) { window.location.href = `/docs/article/${s}`; return; }
      const json: Payload = await res.json();
      setData(json);
      recordHistory({ id: json.article.id, title: json.article.title, slug: json.article.slug });
      // Record the read (bumps views + feeds recommendations) after a short dwell.
      setTimeout(() => {
        fetch('/api/reading', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: json.article.id }), keepalive: true,
        }).catch(() => {});
      }, 3500);
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') window.location.href = `/docs/article/${s}`;
    } finally {
      setLoading(false);
    }
  }, [recordHistory]);

  const openArticle = useCallback((s: string) => {
    const target = `/docs/article/${s}`;
    if (location.pathname !== target) {
      window.history.pushState({ rsnewsModal: s }, '', target);
    }
    setSlug(s);
    load(s);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [load]);

  const clear = useCallback(() => {
    setSlug(null);
    setData(null);
    abortRef.current?.abort();
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.rsnewsModal) window.history.back();
    else clear();
  }, [clear]);

  // Back button / popstate closes (or switches) the modal.
  useEffect(() => {
    const onPop = () => {
      const s = window.history.state?.rsnewsModal;
      if (s) { setSlug(s); load(s); } else clear();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load, clear]);

  // Escape closes; lock body scroll while open.
  useEffect(() => {
    if (!slug) { document.body.classList.remove('modal-open'); return; }
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, [slug, close]);

  const a = data?.article;

  return (
    <ModalCtx.Provider value={{ openArticle, close }}>
      {children}
      {slug && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden animate-fade-in" role="dialog" aria-modal="true" aria-label={a?.title ?? 'Article'}>
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 flex h-[100dvh] w-full max-w-4xl flex-col sm:h-[94dvh] sm:my-[3dvh] animate-scale-in">
            <div className="flex h-full flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-modal sm:rounded-2xl">
              {/* Sticky top bar */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5 sm:px-6">
                <div className="min-w-0 flex items-center gap-2">
                  {a?.category && <span className="badge shrink-0" style={{ backgroundColor: a.category.color + '22', color: a.category.color }}>{a.category.name}</span>}
                  <span className="truncate text-sm font-medium text-[var(--muted)]">{a?.title ?? 'Loading…'}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a && <StarButton item={{ id: a.id, title: a.title, slug: a.slug }} variant="inline" />}
                  <button onClick={close} className="btn-ghost h-9 w-9 !px-0" aria-label="Close"><X /></button>
                </div>
              </div>

              {/* Scrollable body */}
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                {loading && !a && <ModalSkeleton />}
                {a && (
                  <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
                    {a.status === 'ARCHIVED' && <div className="mb-4"><span className="badge bg-amber-100 text-amber-700">Archived</span></div>}
                    <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{a.title}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
                      {a.author && <span>By {a.author.name}</span>}
                      <span>{formatDate(a.publishedAt)}</span>
                      <span className="flex items-center gap-1"><Clock width={14} height={14} />{a.readMinutes} min read</span>
                      <span className="flex items-center gap-1"><Eye width={14} height={14} />{a.views} views</span>
                    </div>

                    {a.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverImage} alt="" className="mt-6 aspect-[16/9] w-full rounded-xl object-cover" />
                    )}

                    {/* In-article ad #1 */}
                    <div className="my-6"><AdSlot size="in-article" slot="modal-top" /></div>

                    <article className="prose-article" dangerouslySetInnerHTML={{ __html: a.content }} />

                    {a.tags.length > 0 && (
                      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-6">
                        <TagIcon width={16} height={16} className="text-[var(--muted)]" />
                        {a.tags.map((t) => (
                          <a key={t.slug} href={`/docs/tag/${t.slug}`} className="badge border border-[var(--border)] hover:bg-[var(--bg-soft)]">#{t.name}</a>
                        ))}
                      </div>
                    )}

                    {/* In-article ad #2 */}
                    <div className="my-8 flex justify-center"><AdSlot size="rectangle" slot="modal-bottom" /></div>

                    {data?.next && (
                      <button onClick={() => openArticle(data.next!.slug)}
                        className="card card-hover flex w-full items-center justify-between gap-4 p-5 text-left">
                        <span className="min-w-0">
                          <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Read next</span>
                          <span className="mt-1 block truncate font-semibold">{data.next.title}</span>
                        </span>
                        <ArrowRight className="shrink-0 text-brand-600" />
                      </button>
                    )}

                    {data && data.related.length > 0 && (
                      <div className="mt-8">
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">If you read this, you might like…</h2>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {data.related.map((r) => (
                            <button key={r.id} onClick={() => openArticle(r.slug)}
                              className="card card-hover p-4 text-left">
                              {r.category && <span className="text-xs font-medium" style={{ color: r.category.color }}>{r.category.name}</span>}
                              <span className="mt-1 block line-clamp-3 text-sm font-semibold">{r.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalCtx.Provider>
  );
}

function ModalSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl animate-pulse px-4 py-8 sm:px-6">
      <div className="h-8 w-3/4 rounded bg-[var(--bg-soft)]" />
      <div className="mt-4 h-4 w-1/2 rounded bg-[var(--bg-soft)]" />
      <div className="mt-6 aspect-[16/9] w-full rounded-xl bg-[var(--bg-soft)]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 w-full rounded bg-[var(--bg-soft)]" />)}
      </div>
    </div>
  );
}
