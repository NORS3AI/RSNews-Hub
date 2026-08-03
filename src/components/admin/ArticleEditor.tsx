'use client';
import { useState } from 'react';
import Link from 'next/link';
import { saveArticle } from '@/lib/actions';
import { CONTENT_STATUSES } from '@/lib/constants';

type Cat = { id: string; name: string };
type Article = {
  id: string; title: string; content: string; excerpt: string | null; coverImage: string | null;
  status: string; featured: boolean; categoryId: string | null; tags: { tag: { name: string } }[];
};

export default function ArticleEditor({ article, categories }: { article?: Article; categories: Cat[] }) {
  const [content, setContent] = useState(article?.content ?? '');
  const [preview, setPreview] = useState(false);

  return (
    <form action={saveArticle}>
      {article?.id && <input type="hidden" name="id" value={article.id} />}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{article ? 'Edit article' : 'New article'}</h1>
        <div className="flex gap-2">
          <Link href="/admin/articles" className="btn-outline btn-sm">Cancel</Link>
          <button type="submit" className="btn-primary btn-sm">Save</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required defaultValue={article?.title} className="input text-lg" placeholder="Article title" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0" htmlFor="content">Content (HTML)</label>
              <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs text-brand-600 hover:underline">
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="prose-article card min-h-[300px] p-4" dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <textarea id="content" name="content" required value={content} onChange={(e) => setContent(e.target.value)}
                className="input min-h-[340px] font-mono text-sm" placeholder="<p>Write your article here. HTML is supported.</p>" />
            )}
            {preview && <textarea name="content" value={content} readOnly hidden />}
            <p className="mt-1 text-xs text-[var(--muted)]">Supports HTML: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;blockquote&gt;, &lt;img&gt;, &lt;code&gt;…</p>
          </div>

          <div>
            <label className="label" htmlFor="excerpt">Excerpt <span className="font-normal text-[var(--muted)]">(optional — auto-generated if blank)</span></label>
            <textarea id="excerpt" name="excerpt" defaultValue={article?.excerpt ?? ''} className="input min-h-[70px]" placeholder="Short summary shown in cards and previews." />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-4 p-4">
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={article?.status ?? 'DRAFT'} className="input">
                {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="categoryId">Category</label>
              <select id="categoryId" name="categoryId" defaultValue={article?.categoryId ?? ''} className="input">
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="featured" defaultChecked={article?.featured} className="h-4 w-4 rounded border-[var(--border)]" />
              Feature on homepage
            </label>
          </div>

          <div className="card space-y-4 p-4">
            <div>
              <label className="label" htmlFor="tags">Tags</label>
              <input id="tags" name="tags" defaultValue={article?.tags.map((t) => t.tag.name).join(', ')} className="input" placeholder="ai, tutorial, release" />
              <p className="mt-1 text-xs text-[var(--muted)]">Comma-separated. New tags are created automatically.</p>
            </div>
            <div>
              <label className="label" htmlFor="coverImage">Cover image URL</label>
              <input id="coverImage" name="coverImage" type="url" defaultValue={article?.coverImage ?? ''} className="input" placeholder="https://…" />
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
