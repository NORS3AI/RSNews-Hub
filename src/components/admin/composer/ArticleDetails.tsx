'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { uploadImage } from '@/lib/uploadClient';
import { CONTENT_STATUSES } from '@/lib/constants';
import { suggestTags } from '@/lib/suggestTags';
import { useComposer } from './context';

type Cat = { id: string; name: string };
type Article = {
  status: string; requirement?: string; featured: boolean; pinned?: boolean; categoryId: string | null;
  coverImage?: string | null;
  tags: { tag: { name: string } }[]; extraCategories?: { id: string }[]; breakingUntil?: string | Date | null;
  publishedAt?: string | Date | null;
  audioStatus?: string; audioUrl?: string | null;
};

const AUDIO_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: '🎧 Audio generating…', cls: 'bg-amber-100 text-amber-800' },
  READY: { text: '🎧 Audio ready', cls: 'bg-green-100 text-green-700' },
  FAILED: { text: '🎧 Audio failed — retries nightly', cls: 'bg-red-100 text-red-700' },
};

function toLocalInput(d?: string | Date | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</div>
    {children}
  </div>
);

export default function ArticleDetails({ article, categories }: { article?: Article; categories: Cat[] }) {
  const { html } = useComposer();
  const [cover, setCover] = useState(article?.coverImage as string ?? '');
  const [imgError, setImgError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initiallyBreaking = !!(article?.breakingUntil && new Date(article.breakingUntil).getTime() > Date.now());
  const [breaking, setBreaking] = useState<string>(initiallyBreaking ? 'keep' : '');
  const [tags, setTags] = useState(article?.tags.map((t) => t.tag.name).join(', ') ?? '');
  const extraIds = new Set((article?.extraCategories ?? []).map((c) => c.id));

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImgError(null); setUploading(true);
    const res = await uploadImage(file); setUploading(false);
    if (res.ok) setCover(res.url); else setImgError(res.error);
    if (fileRef.current) fileRef.current.value = '';
  }
  function onSuggestTags() {
    const title = (document.getElementById('title') as HTMLInputElement)?.value || '';
    const picked = suggestTags(title, html);
    const existing = tags.split(',').map((t) => t.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existing, ...picked])).slice(0, 8);
    setTags(merged.join(', '));
  }

  return (
    <div className="space-y-6">
      <Section title="Publish">
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={article?.status ?? 'DRAFT'} className="input">
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="publishedAt">Publish date &amp; time</label>
          <input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={toLocalInput(article?.publishedAt)} className="input" />
          <p className="mt-1 text-xs text-[var(--muted)]">Blank = now. A past date backdates; a future date schedules it (needs status Published).</p>
        </div>
        {article?.audioStatus && article.audioStatus !== 'NONE' && (
          <div className="flex items-center justify-between gap-2">
            <span className={`badge ${AUDIO_LABEL[article.audioStatus]?.cls ?? 'bg-[var(--bg-soft)]'}`}>{AUDIO_LABEL[article.audioStatus]?.text ?? article.audioStatus}</span>
            {article.audioStatus === 'READY' && article.audioUrl && <a href={article.audioUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 hover:underline">Preview ↗</a>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="breakingHours">Breaking News timer</label>
          <select id="breakingHours" name="breakingHours" value={breaking} onChange={(e) => setBreaking(e.target.value)} className="input">
            {initiallyBreaking && <option value="keep">⚡ Keep current</option>}
            <option value="">{initiallyBreaking ? 'Turn off breaking' : 'Not breaking'}</option>
            <option value="24">Breaking for 24 hours</option>
            <option value="48">Breaking for 48 hours</option>
            <option value="72">Breaking for 72 hours</option>
            <option value="custom">Custom…</option>
          </select>
          {breaking === 'custom' && <input type="number" name="breakingCustomHours" min={1} max={720} defaultValue={48} className="input mt-2" placeholder="Hours" />}
        </div>
      </Section>

      <Section title="Categories">
        <div>
          <label className="label" htmlFor="categoryId">Primary</label>
          <select id="categoryId" name="categoryId" defaultValue={article?.categoryId ?? ''} className="input">
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Also in</label>
          <div className="grid max-h-40 grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2.5">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="extraCategoryIds" value={c.id} defaultChecked={extraIds.has(c.id)} className="h-4 w-4 rounded border-[var(--border)]" />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Homepage & access">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="featured" defaultChecked={article?.featured} className="mt-0.5 h-4 w-4 rounded border-[var(--border)]" />
          <span><span className="font-medium">Featured headline</span><br /><span className="text-xs text-[var(--muted)]">Eligible for the big hero.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="pinned" defaultChecked={article?.pinned} className="mt-0.5 h-4 w-4 rounded border-[var(--border)]" />
          <span><span className="font-medium">Pin to top</span><br /><span className="text-xs text-[var(--muted)]">Force above newer stories.</span></span>
        </label>
        <div>
          <label className="label" htmlFor="requirement">Who can read</label>
          <input id="requirement" name="requirement" list="requirement-opts" defaultValue={article?.requirement ?? ''} className="input" placeholder="public" autoComplete="off" />
          <datalist id="requirement-opts">
            <option value="public">Everyone (public)</option><option value="member">Any signed-in member</option>
            <option value="premium">RS Premium</option><option value="packagehub">Package Hub</option>
            <option value="vendor">Vendors</option><option value="staff">Staff</option>
          </datalist>
          <p className="mt-1 text-xs text-[var(--muted)]">Blank/<code>public</code> = everyone. Or a tier / account type / affiliation key.</p>
        </div>
      </Section>

      <Section title="Cover image">
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
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline btn-sm w-full">{uploading ? 'Uploading…' : 'Upload image'}</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
        <input type="url" value={cover.startsWith('data:') ? '' : cover} onChange={(e) => setCover(e.target.value)} className="input" placeholder="…or paste an image URL" />
        {imgError && <p className="text-xs text-red-600">{imgError}</p>}
      </Section>

      <Section title="Tags">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Comma-separated.</span>
          <button type="button" onClick={onSuggestTags} className="text-xs font-bold text-brand-600 hover:underline">✨ Suggest</button>
        </div>
        <input name="tags" value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="usps, rates, counter" />
      </Section>
    </div>
  );
}
