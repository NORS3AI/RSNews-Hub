'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { saveArticle, discardDraft } from '@/lib/actions';
import { ComposerProvider, type Opt, type Advertiser, type ReservedAdOpt } from './composer/context';
import Palette from './composer/Palette';
import Canvas from './composer/Canvas';
import Inspector from './composer/Inspector';
import SimpleUpload from './composer/SimpleUpload';
import AutoSave from './AutoSave';

// Warn before leaving with unsaved edits: mark dirty on any edit in the form
// (typing, field changes), clear it on submit, and gate a tab close / reload on it.
function useUnsavedGuard(formRef: React.RefObject<HTMLFormElement | null>) {
  const dirty = useRef(false);
  useEffect(() => {
    const form = formRef.current;
    const mark = () => { dirty.current = true; };
    const clear = () => { dirty.current = false; };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    form?.addEventListener('input', mark);
    form?.addEventListener('submit', clear);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => { form?.removeEventListener('input', mark); form?.removeEventListener('submit', clear); window.removeEventListener('beforeunload', onBeforeUnload); };
  }, [formRef]);
}

type Cat = { id: string; name: string; color?: string };
type Article = {
  id: string; title: string; content: string; excerpt: string | null; byline?: string | null; coverImage: string | null;
  status: string; requirement?: string; genre?: string; featured: boolean; pinned?: boolean; categoryId: string | null;
  tags: { tag: { name: string } }[]; extraCategories?: { id: string }[]; breakingUntil?: string | Date | null;
  sponsoredUntil?: string | Date | null;
  publishedAt?: string | Date | null; views?: number; draftSavedAt?: string | Date | null;
};

// The article builder: element palette (left), flowing canvas (center), and a
// tabbed inspector (right) for Article details vs the selected element — one
// shared TipTap editor behind all three, via ComposerProvider.
export default function ArticleEditor({
  article, categories, polls = [], quizzes = [], advertisers = [], reservedAds = [], authorName = 'You',
}: { article?: Article; categories: Cat[]; polls?: Opt[]; quizzes?: Opt[]; advertisers?: Advertiser[]; reservedAds?: ReservedAdOpt[]; authorName?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedGuard(formRef);
  return (
    <form ref={formRef} action={saveArticle}>
      {article?.id && <input type="hidden" name="id" value={article.id} />}
      {/* excerpt is optional + auto-generated; keep it out of the way but submittable */}
      <input type="hidden" name="excerpt" value={article?.excerpt ?? ''} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{article ? 'Edit article' : 'New article'}</h1>
        <div className="flex items-center gap-3">
          {article?.id && <AutoSave formRef={formRef} />}
          <Link href="/admin/articles" className="btn-outline btn-sm">Cancel</Link>
          <button type="submit" className="btn-primary btn-sm">Save</button>
        </div>
      </div>

      {article?.id && article.draftSavedAt && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <span className="text-amber-900 dark:text-amber-200">
            You&apos;re editing an <b>autosaved draft</b> (saved {new Date(article.draftSavedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}). It isn&apos;t live yet — <b>Save</b> to publish these changes, or discard to go back to the live version.
          </span>
          {/* formAction submits to discardDraft instead of saveArticle (no nested form). */}
          <button type="submit" formAction={discardDraft.bind(null, article.id)}
            className="btn-outline btn-sm shrink-0" formNoValidate>Discard draft</button>
        </div>
      )}

      <ComposerProvider initialHTML={article?.content ?? ''} polls={polls} quizzes={quizzes} advertisers={advertisers} reservedAds={reservedAds}>
        <div className="grid gap-5 lg:grid-cols-[188px_1fr_330px]">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-20 lg:self-start">
            <div className="card p-3">
              <Palette />
            </div>
          </aside>

          <div className="order-1 min-w-0 lg:order-2">
            <SimpleUpload />
            <Canvas initialTitle={article?.title} categories={categories}
              previewMeta={{ author: authorName, views: article?.views ?? 0 }} />
          </div>

          <aside className="order-3 lg:sticky lg:top-20 lg:self-start">
            <div className="card p-4">
              <Inspector article={article} categories={categories} />
            </div>
          </aside>
        </div>
      </ComposerProvider>
    </form>
  );
}
