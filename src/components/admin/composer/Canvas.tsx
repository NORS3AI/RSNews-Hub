'use client';
import { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { useComposer } from './context';
import ArticleContent from '@/components/site/ArticleContent';
import { formatDate } from '@/lib/utils';
import { Bold, Italic, LinkIcon, Eye, X, Clock, Star, Pin, Share, Scissors } from '@/components/icons';

type Cat = { id: string; name: string; color?: string };
type PreviewData = { title: string; cover: string; cats: { name: string; color: string }[]; breaking: boolean; date: string; readMin: number };

function TB({ on, active, title, children }: { on: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`grid h-8 w-8 place-items-center rounded-lg transition ${active ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]'}`}>
      {children}
    </button>
  );
}

export default function Canvas({
  initialTitle = '', categories = [], previewMeta = { author: 'You', views: 0 },
}: { initialTitle?: string; categories?: Cat[]; previewMeta?: { author: string; views: number } }) {
  const { editor, html, polls, quizzes } = useComposer();
  const [mode, setMode] = useState<'write' | 'html'>('write');
  const [raw, setRaw] = useState(html);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'rs'>('light');
  if (!editor) return <div className="input min-h-[420px] animate-pulse" />;

  function openPreview() {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value || '';
    const byId = new Map(categories.map((c) => [c.id, c]));
    const primaryId = val('categoryId');
    const extraIds = Array.from(document.querySelectorAll('input[name="extraCategoryIds"]:checked')).map((el) => (el as HTMLInputElement).value);
    const catIds = [primaryId, ...extraIds].filter(Boolean);
    const seen = new Set<string>();
    const cats = catIds.map((id) => byId.get(id)).filter((c): c is Cat => !!c && !seen.has(c.id) && !!seen.add(c.id))
      .map((c) => ({ name: c.name, color: c.color || '#E97D34' }));
    const breaking = !!val('breakingHours');
    // Match the hub: when Breaking is on, the ⚡ badge stands in for the
    // "Breaking News" category, so don't show both.
    const shownCats = breaking ? cats.filter((c) => c.name.toLowerCase() !== 'breaking news') : cats;
    const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    setPreview({
      title: val('title') || 'Untitled',
      cover: (document.querySelector('input[name="coverImage"]') as HTMLInputElement)?.value || '',
      cats: shownCats, breaking,
      date: val('publishedAt') ? formatDate(new Date(val('publishedAt'))) : formatDate(new Date()),
      readMin: Math.max(1, Math.round(words / 200)),
    });
  }

  function addLink() {
    const prev = editor!.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url.trim() === '') editor!.chain().focus().unsetLink().run();
    else editor!.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }
  function openHtml() { setRaw(editor!.getHTML()); setMode('html'); }
  function syncHtml() { editor!.commands.setContent(raw || '<p></p>'); }
  function closeHtml() { syncHtml(); setMode('write'); }

  const themeBtn = (t: 'light' | 'dark' | 'rs', label: string) => (
    <button type="button" onClick={() => setTheme(t)}
      className={`rounded-md px-2.5 py-1 text-xs font-bold ${theme === t ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>{label}</button>
  );
  const FakeBtn = ({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) => (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${primary ? 'bg-brand-600 text-white' : 'border border-[var(--border)] text-[var(--fg)]'}`}>{icon}{label}</span>
  );

  return (
    <div>
      <label className="label" htmlFor="title">Title</label>
      <input id="title" name="title" required defaultValue={initialTitle} placeholder="Your headline…"
        className="input mb-4 !text-2xl !font-black" />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
          {mode === 'write' ? (
            <>
              <TB on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold width={16} height={16} /></TB>
              <TB on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic width={16} height={16} /></TB>
              <TB on={addLink} active={editor.isActive('link')} title="Link"><LinkIcon width={16} height={16} /></TB>
              <span className="ml-1 hidden text-xs text-[var(--muted)] sm:inline">Select text to format · headings &amp; lists are on the left</span>
              <button type="button" onClick={openPreview} className="btn-outline btn-sm ml-auto gap-1.5"><Eye width={15} height={15} /> Preview</button>
              <button type="button" onClick={openHtml} className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]">&lt;/&gt; HTML</button>
            </>
          ) : (
            <>
              <span className="px-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Raw HTML</span>
              <button type="button" onClick={closeHtml} className="ml-auto btn-primary btn-sm">Done</button>
            </>
          )}
        </div>
        {mode === 'write' ? (
          <EditorContent editor={editor} className="max-h-[64vh] min-h-[420px] overflow-y-auto px-4 py-4" />
        ) : (
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={syncHtml}
            className="min-h-[420px] w-full resize-y bg-[var(--card)] p-4 font-mono text-sm outline-none" />
        )}
      </div>

      {/* Live preview — the real reader modal, in whichever theme you pick. */}
      {preview && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/60 p-3 py-[4vh] backdrop-blur-sm" onClick={() => setPreview(null)}>
          {/* RS = light palette + RS overrides, so it's correct even if the admin is in dark mode. */}
          <div className={theme === 'rs' ? 'light rs' : theme}>
            <div className="w-full max-w-[880px] overflow-hidden rounded-2xl bg-[var(--card)] text-[var(--fg)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* Top bar — badges + title + Favorite / Pin / Share, plus a theme switch + close */}
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  {preview.breaking && <span className="badge shrink-0 whitespace-nowrap" style={{ background: '#d23b2e', color: '#fff' }}>⚡ Breaking</span>}
                  {preview.cats.slice(0, 2).map((c) => <span key={c.name} className="badge cat-badge shrink-0" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span>)}
                  <span className="truncate text-sm font-semibold text-[var(--muted)]">{preview.title}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <FakeBtn icon={<Star width={15} height={15} />} label="Favorite" />
                  <FakeBtn icon={<Pin width={15} height={15} />} label="Pin" primary />
                  <span className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)]"><Share width={16} height={16} /></span>
                  <button type="button" onClick={() => setPreview(null)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--bg-soft)]"><X width={18} height={18} /></button>
                </div>
              </div>

              {/* Theme switch bar */}
              <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--card-2)] px-4 py-1.5">
                <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Preview theme</span>
                {themeBtn('light', 'Light')}{themeBtn('dark', 'Dark')}{themeBtn('rs', 'RS')}
              </div>

              <div className="max-h-[76vh] overflow-y-auto px-6 py-6 sm:px-9 sm:py-8">
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:bg-brand-950/30">
                  <Scissors width={16} height={16} /> Tip: highlight any text to turn it into a shareable quote image.
                </div>
                <h1 className="text-3xl font-black leading-tight sm:text-4xl">{preview.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                  <span>By {previewMeta.author}</span>
                  <span>{preview.date}</span>
                  <span className="flex items-center gap-1"><Clock width={14} height={14} />{preview.readMin} min read</span>
                  <span className="flex items-center gap-1"><Eye width={14} height={14} />{previewMeta.views} views</span>
                </div>
                {preview.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.cover} alt="" className="mt-7 aspect-[16/9] w-full rounded-xl object-cover" />
                )}
                <div className="prose-article mt-7" data-reader><ArticleContent html={html} polls={polls} quizzes={quizzes} /></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
