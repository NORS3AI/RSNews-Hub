'use client';
import Link from 'next/link';
import { saveArticle } from '@/lib/actions';
import { ComposerProvider, type Opt, type Advertiser } from './composer/context';
import Palette from './composer/Palette';
import Canvas from './composer/Canvas';
import Inspector from './composer/Inspector';

type Cat = { id: string; name: string; color?: string };
type Article = {
  id: string; title: string; content: string; excerpt: string | null; coverImage: string | null;
  status: string; requirement?: string; featured: boolean; pinned?: boolean; categoryId: string | null;
  tags: { tag: { name: string } }[]; extraCategories?: { id: string }[]; breakingUntil?: string | Date | null;
  publishedAt?: string | Date | null; views?: number;
};

// The article builder: element palette (left), flowing canvas (center), and a
// tabbed inspector (right) for Article details vs the selected element — one
// shared TipTap editor behind all three, via ComposerProvider.
export default function ArticleEditor({
  article, categories, polls = [], quizzes = [], advertisers = [], authorName = 'You',
}: { article?: Article; categories: Cat[]; polls?: Opt[]; quizzes?: Opt[]; advertisers?: Advertiser[]; authorName?: string }) {
  return (
    <form action={saveArticle}>
      {article?.id && <input type="hidden" name="id" value={article.id} />}
      {/* excerpt is optional + auto-generated; keep it out of the way but submittable */}
      <input type="hidden" name="excerpt" value={article?.excerpt ?? ''} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{article ? 'Edit article' : 'New article'}</h1>
        <div className="flex gap-2">
          <Link href="/admin/articles" className="btn-outline btn-sm">Cancel</Link>
          <button type="submit" className="btn-primary btn-sm">Save</button>
        </div>
      </div>

      <ComposerProvider initialHTML={article?.content ?? ''} polls={polls} quizzes={quizzes} advertisers={advertisers}>
        <div className="grid gap-5 lg:grid-cols-[188px_1fr_330px]">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-20 lg:self-start">
            <div className="card p-3">
              <Palette />
            </div>
          </aside>

          <div className="order-1 min-w-0 lg:order-2">
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
