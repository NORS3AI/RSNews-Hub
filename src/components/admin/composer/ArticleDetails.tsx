'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { uploadImage, uploadVideo } from '@/lib/uploadClient';
import { CONTENT_STATUSES } from '@/lib/constants';
import { suggestArticleTags } from '@/lib/actions';
import { useComposer } from './context';
import { Sparkles } from '@/components/icons';

type Cat = { id: string; name: string };
type Vendor = { id: string; name: string };
type GenreOpt = { slug: string; label: string };
type BylineOpt = { id: string; name: string; title: string | null; photo: string | null; bio: string | null };
type Article = {
  status: string; requirement?: string; genre?: string; featured: boolean; pinned?: boolean; categoryId: string | null;
  byline?: string | null; bylineId?: string | null;
  coverImage?: string | null; coverVideo?: string | null; coverFocus?: string | null;
  tags: { tag: { name: string } }[]; extraCategories?: { id: string }[]; breakingUntil?: string | Date | null;
  sponsoredUntil?: string | Date | null; sponsorVendorId?: string | null;
  publishedAt?: string | Date | null;
};

// The 9 focal points, as CSS object-position values. Center is the default and
// stores as blank (so an untouched cover carries no override).
const FOCUS_POINTS = [
  '0% 0%', '50% 0%', '100% 0%',
  '0% 50%', '50% 50%', '100% 50%',
  '0% 100%', '50% 100%', '100% 100%',
];

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

export default function ArticleDetails({ article, categories, vendors = [], bylines = [], genres = [] }: { article?: Article; categories: Cat[]; vendors?: Vendor[]; bylines?: BylineOpt[]; genres?: GenreOpt[] }) {
  // Byline picker state: '' = the house team default, 'custom' = a typed one-off
  // name (the free-text field), otherwise a saved byline id from the library.
  const [bylinePick, setBylinePick] = useState<string>(article?.bylineId || (article?.byline ? 'custom' : ''));
  const { html } = useComposer();
  // Connected vendor — the advertiser a sponsored or What's Hot piece belongs to.
  // Setting it locks the article's in-article ads to that vendor (house fallback)
  // and lets us push it to their dashboard for review. We nudge (but never force)
  // picking one when the article is filed under What's Hot.
  const whatsHotId = categories.find((c) => c.name === "What's Hot")?.id ?? '';
  const breakingCatId = categories.find((c) => c.name === 'Breaking News')?.id ?? '';
  const [primaryCat, setPrimaryCat] = useState(article?.categoryId ?? '');
  const [extraCatSet, setExtraCatSet] = useState<Set<string>>(new Set((article?.extraCategories ?? []).map((c) => c.id)));
  const [vendorSel, setVendorSel] = useState(article?.sponsorVendorId ?? '');
  const isWhatsHot = !!whatsHotId && (primaryCat === whatsHotId || extraCatSet.has(whatsHotId));
  // The Breaking News timer only makes sense for a Breaking News article, so it
  // appears (under Categories) only once that category is picked (primary or extra).
  const isBreakingCat = !!breakingCatId && (primaryCat === breakingCatId || extraCatSet.has(breakingCatId));
  const [cover, setCover] = useState(article?.coverImage as string ?? '');
  const [focus, setFocus] = useState((article?.coverFocus as string) || '50% 50%');
  const [imgError, setImgError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Optional cover VIDEO (plays on the reader + hero; the image above is its poster).
  const [video, setVideo] = useState(article?.coverVideo as string ?? '');
  const [vidError, setVidError] = useState<string | null>(null);
  const [vidUploading, setVidUploading] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);
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
  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setVidError(null); setVidUploading(true);
    const res = await uploadVideo(file); setVidUploading(false);
    if (res.ok) setVideo(res.url); else setVidError(res.error);
    if (videoRef.current) videoRef.current.value = '';
  }
  const [suggesting, setSuggesting] = useState(false);
  async function onSuggestTags() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const title = (document.getElementById('title') as HTMLInputElement)?.value || '';
      const picked = await suggestArticleTags(title, html);
      const existing = tags.split(',').map((t) => t.trim()).filter(Boolean);
      // Case-insensitive dedup so a suggestion already on the list isn't re-added.
      const seen = new Set(existing.map((t) => t.toLowerCase()));
      const merged = [...existing];
      for (const p of picked) { if (!seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); merged.push(p); } }
      setTags(merged.slice(0, 10).join(', '));
    } finally {
      setSuggesting(false);
    }
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
      </Section>

      <Section title="Byline">
        <div>
          <label className="label" htmlFor="bylinePick">Shown to readers as &ldquo;By …&rdquo;</label>
          <select id="bylinePick" className="input" value={bylinePick} onChange={(e) => setBylinePick(e.target.value)}>
            <option value="">RS News Hub Team (default)</option>
            {bylines.map((b) => <option key={b.id} value={b.id}>{b.name}{b.title ? ` — ${b.title}` : ''}</option>)}
            <option value="custom">Custom name…</option>
          </select>
          {/* The saved-byline id we submit (blank for the team default or a one-off). */}
          <input type="hidden" name="bylineId" value={bylinePick && bylinePick !== 'custom' ? bylinePick : ''} />
          {bylinePick === 'custom'
            ? <input name="byline" defaultValue={article?.byline ?? ''} maxLength={120} autoComplete="off" className="input mt-2" placeholder="e.g. Guest Contributor" />
            : <input type="hidden" name="byline" value="" />}
          <p className="mt-1 text-xs text-[var(--muted)]">
            Defaults to <b>RS News Hub Team</b> (no photo). Pick a saved byline for a named author with photo &amp; title, or type a one-off name.{' '}
            <a href="/admin/bylines" target="_blank" rel="noreferrer" className="text-brand-600 underline">Manage bylines →</a>
          </p>
        </div>
      </Section>

      <Section title="Categories">
        <div>
          <label className="label" htmlFor="categoryId">Primary</label>
          <select id="categoryId" name="categoryId" defaultValue={article?.categoryId ?? ''} onChange={(e) => setPrimaryCat(e.target.value)} className="input">
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Also in</label>
          <div className="grid max-h-40 grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2.5">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="extraCategoryIds" value={c.id} defaultChecked={extraIds.has(c.id)}
                  onChange={(e) => setExtraCatSet((prev) => { const n = new Set(prev); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                  className="h-4 w-4 rounded border-[var(--border)]" />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
        {/* Breaking News timer — only when the Breaking News category is picked. */}
        {isBreakingCat && (
          <div>
            <label className="label" htmlFor="breakingHours">Breaking News timer</label>
            <select id="breakingHours" name="breakingHours" value={breaking} onChange={(e) => setBreaking(e.target.value)} className="input">
              {initiallyBreaking && <option value="keep">Keep current</option>}
              <option value="">{initiallyBreaking ? 'Turn off breaking' : 'Not breaking'}</option>
              <option value="24">Breaking for 24 hours</option>
              <option value="48">Breaking for 48 hours</option>
              <option value="72">Breaking for 72 hours</option>
              <option value="custom">Custom…</option>
            </select>
            {breaking === 'custom' && <input type="number" name="breakingCustomHours" min={1} max={720} defaultValue={48} className="input mt-2" placeholder="Hours" />}
            <p className="mt-1 text-xs text-[var(--muted)]">How long the red <strong>Breaking</strong> badge + top billing lasts, then it eases back to a normal story.</p>
          </div>
        )}
        {/* Genre lives with Categories — both classify the piece. */}
        <div>
          <label className="label" htmlFor="genre">Genre <span className="font-normal text-[var(--muted)]">(optional)</span></label>
          <select id="genre" name="genre" defaultValue={article?.genre ?? ''} className="input">
            <option value="">None</option>
            {/* Keep the article's current genre selectable even if it was since
                archived/removed from the list — otherwise it silently drops on save. */}
            {article?.genre && !genres.some((g) => g.slug === article.genre) && (
              <option value={article.genre}>{article.genre} (archived)</option>
            )}
            {genres.map((g) => <option key={g.slug} value={g.slug}>{g.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            The nature of the piece, shown as a small badge. Use <strong>Sponsored</strong> for paid/vendor content (disclosure). Leave as None for straight news.{' '}
            <a href="/admin/genres" target="_blank" rel="noreferrer" className="text-brand-600 underline">Manage genres →</a>
          </p>
        </div>
        {/* Connected vendor — the advertiser this piece belongs to. */}
        <div>
          <label className="label" htmlFor="sponsorVendorId">Connected vendor <span className="font-normal text-[var(--muted)]">(optional)</span></label>
          <select id="sponsorVendorId" name="sponsorVendorId" value={vendorSel} onChange={(e) => setVendorSel(e.target.value)} className="input">
            <option value="">None</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Locks this article’s in-article ads to that vendor (RS house ads fill any gaps — never a competitor), and lets you send it to their dashboard for review.
          </p>
          {isWhatsHot && !vendorSel && (
            <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              This is a <strong>What’s Hot</strong> article — connect the vendor it’s about so their ads run in it and they can review it. (Leave as None to override.)
            </p>
          )}
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
            <option value="premium">RS Premium</option><option value="packagehub">PackageHub</option>
            <option value="vendor">Vendors</option><option value="staff">Staff</option>
          </datalist>
          <p className="mt-1 text-xs text-[var(--muted)]">Blank/<code>public</code> = everyone. Or a tier / account type / affiliation key.</p>
        </div>
        <div>
          <label className="label" htmlFor="sponsoredUntil">Featured (sponsored) until <span className="font-normal text-[var(--muted)]">(optional)</span></label>
          <input id="sponsoredUntil" name="sponsoredUntil" type="datetime-local" defaultValue={toLocalInput(article?.sponsoredUntil)} className="input" />
          <p className="mt-1 text-xs text-[var(--muted)]">While this date is in the future, the article floats into the <strong>Featured</strong> homepage module (below the top three) and auto-drops out when it passes. A typical paid run is ~30 days. Blank = not sponsored.</p>
        </div>
      </Section>

      <Section title="Cover image">
        {cover ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="aspect-[16/9] w-full rounded-lg border border-[var(--border)] object-cover" style={{ objectPosition: focus }} />
            <button type="button" onClick={() => { setCover(''); if (fileRef.current) fileRef.current.value = ''; }}
              className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80">Remove</button>
            {/* 9-point focal picker overlaid on the preview — click the spot that
                should stay in frame when the cover is cropped (hero ⅔, cards…). */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 p-1.5">
              {FOCUS_POINTS.map((pt) => (
                <button key={pt} type="button" onClick={() => setFocus(pt)} aria-label={`Focus ${pt}`} aria-pressed={focus === pt}
                  className="pointer-events-auto grid place-items-center">
                  <span className={`h-3 w-3 rounded-full border-2 border-white shadow transition ${focus === pt ? 'bg-brand-500 ring-2 ring-white' : 'bg-black/30 hover:bg-black/60'}`} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid aspect-[16/9] w-full place-items-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">No cover</div>
        )}
        {cover && (
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Focal point — click a dot to set what stays in frame when cropped.</span>
            {focus !== '50% 50%' && <button type="button" onClick={() => setFocus('50% 50%')} className="font-semibold text-brand-600 hover:underline">Center</button>}
          </div>
        )}
        <input type="hidden" name="coverImage" value={cover} />
        {/* Center is the default → store blank so an untouched cover has no override. */}
        <input type="hidden" name="coverFocus" value={focus === '50% 50%' ? '' : focus} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline btn-sm w-full">{uploading ? 'Uploading…' : 'Upload image'}</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
        <input type="url" value={cover.startsWith('data:') ? '' : cover} onChange={(e) => setCover(e.target.value)} className="input" placeholder="…or paste an image URL" />
        {imgError && <p className="text-xs text-red-600">{imgError}</p>}

        {/* Optional cover VIDEO — plays on the article reader + homepage hero
            (muted, looping); the image above is its still poster / fallback. */}
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fg)]">Cover video <span className="font-normal text-[var(--muted)]">(optional)</span></span>
            {video && <button type="button" onClick={() => { setVideo(''); if (videoRef.current) videoRef.current.value = ''; }} className="text-xs font-semibold text-brand-600 hover:underline">Remove</button>}
          </div>
          {video ? (
            <video src={video} muted loop playsInline autoPlay className="aspect-[16/9] w-full rounded-lg border border-[var(--border)] object-cover" />
          ) : (
            <p className="mb-2 text-xs text-[var(--muted)]">Plays on the reader &amp; hero only. The image above is the poster shown on cards, shares and while it loads.</p>
          )}
          <button type="button" onClick={() => videoRef.current?.click()} disabled={vidUploading} className="btn-outline btn-sm mt-2 w-full">{vidUploading ? 'Uploading…' : (video ? 'Replace video' : 'Upload cover video (mp4/webm)')}</button>
          <input ref={videoRef} type="file" accept="video/mp4,video/webm" onChange={onPickVideo} className="hidden" />
          <input type="hidden" name="coverVideo" value={video} />
          {vidError && <p className="mt-1 text-xs text-red-600">{vidError}</p>}
        </div>
      </Section>

      <Section title="Tags">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Comma-separated.</span>
          <button type="button" onClick={onSuggestTags} disabled={suggesting} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:underline disabled:opacity-50"><Sparkles width={12} height={12} />{suggesting ? 'Suggesting…' : 'Suggest'}</button>
        </div>
        <input name="tags" value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="usps, rates, counter" />
      </Section>
    </div>
  );
}
