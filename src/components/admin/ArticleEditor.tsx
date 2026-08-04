'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { saveArticle } from '@/lib/actions';
import { uploadImage } from '@/lib/uploadClient';
import { CONTENT_STATUSES } from '@/lib/constants';

type Cat = { id: string; name: string };
type Article = {
  id: string; title: string; content: string; excerpt: string | null; coverImage: string | null;
  status: string; featured: boolean; pinned?: boolean; categoryId: string | null; tags: { tag: { name: string } }[];
  publishedAt?: string | Date | null;
};

function toLocalInput(d?: string | Date | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export default function ArticleEditor({ article, categories }: { article?: Article; categories: Cat[] }) {
  const [content, setContent] = useState(article?.content ?? '');
  const [preview, setPreview] = useState(false);
  const [cover, setCover] = useState(article?.coverImage ?? '');
  const [imgError, setImgError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError(null);
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (res.ok) setCover(res.url);
    else setImgError(res.error);
    if (fileRef.current) fileRef.current.value = '';
  }

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
            <p className="mt-1 text-xs text-[var(--muted)]">Supports HTML incl. inline images: &lt;img src=&quot;https://…&quot;&gt;. Also &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;blockquote&gt;, &lt;code&gt;…</p>
          </div>

          <div>
            <label className="label" htmlFor="excerpt">Excerpt <span className="font-normal text-[var(--muted)]">(optional — auto-generated if blank)</span></label>
            <textarea id="excerpt" name="excerpt" defaultValue={article?.excerpt ?? ''} className="input min-h-[70px]" placeholder="Short summary used for previews & search." />
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
            <div>
              <label className="label" htmlFor="publishedAt">Publish date &amp; time</label>
              <input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={toLocalInput(article?.publishedAt)} className="input" />
              <p className="mt-1 text-xs text-[var(--muted)]">Leave blank to publish now. Set a <strong>past</strong> date to backdate (e.g. old magazine issues), or a <strong>future</strong> date to schedule — the story stays hidden until then. Requires status = Published.</p>
            </div>
          </div>

          {/* Homepage placement */}
          <div className="card space-y-3 p-4">
            <div className="text-sm font-semibold">Homepage placement</div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="featured" defaultChecked={article?.featured} className="mt-0.5 h-4 w-4 rounded border-[var(--border)]" />
              <span><span className="font-medium">Featured headline</span><br /><span className="text-xs text-[var(--muted)]">Can appear as the big hero at the top.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="pinned" defaultChecked={article?.pinned} className="mt-0.5 h-4 w-4 rounded border-[var(--border)]" />
              <span><span className="font-medium">Pin to top</span><br /><span className="text-xs text-[var(--muted)]">Force above newer stories in the Latest list.</span></span>
            </label>
            <p className="text-xs text-[var(--muted)]">Which modules a story appears in (Trending, Recommended, category spotlights…) is driven automatically by views, tags and readers. Reorder the modules themselves under <Link href="/admin/homepage" className="text-brand-600 hover:underline">Homepage layout</Link>.</p>
          </div>

          {/* Cover image */}
          <div className="card space-y-3 p-4">
            <div className="text-sm font-semibold">Cover image</div>
            {cover ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt="" className="aspect-[16/9] w-full rounded-lg border border-[var(--border)] object-cover" />
                <button type="button" onClick={() => { setCover(''); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80">Remove</button>
              </div>
            ) : (
              <div className="grid aspect-[16/9] w-full place-items-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">No cover</div>
            )}
            <input type="hidden" name="coverImage" value={cover} />
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline btn-sm flex-1">
                {uploading ? 'Uploading…' : 'Upload image'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
            <div>
              <label className="label text-xs" htmlFor="coverUrl">…or paste an image URL</label>
              <input id="coverUrl" type="url" value={cover.startsWith('data:') ? '' : cover}
                onChange={(e) => setCover(e.target.value)} className="input" placeholder="https://…" />
            </div>
            {imgError && <p className="text-xs text-red-600">{imgError}</p>}
            <p className="text-xs text-[var(--muted)]">Uploaded images are stored in your asset storage and referenced by URL (max 8MB). You can also paste an image URL.</p>
          </div>

          {/* Tags */}
          <div className="card space-y-2 p-4">
            <label className="label" htmlFor="tags">Tags</label>
            <input id="tags" name="tags" defaultValue={article?.tags.map((t) => t.tag.name).join(', ')} className="input" placeholder="ai, tutorial, release" />
            <p className="text-xs text-[var(--muted)]">Comma-separated. New tags are created automatically.</p>
          </div>
        </aside>
      </div>
    </form>
  );
}
