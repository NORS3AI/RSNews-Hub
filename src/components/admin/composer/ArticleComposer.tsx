'use client';
import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { AdSlot, Spacer, PollEmbed, QuizEmbed, CtaButton, PullQuote, Author } from './extensions';
import { uploadImage } from '@/lib/uploadClient';
import {
  Bold, Italic, H1, H2, ListBullet, ListOrdered, Quote, LinkIcon, ImageIcon,
  Megaphone, Minus, Rows, BarChart, CursorClick, Plus, X, Check, Users,
} from '@/components/icons';

type Opt = { id: string; title: string };

// A tidy toolbar button.
function TB({ on, active, disabled, title, children }: { on: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`grid h-8 w-8 place-items-center rounded-lg text-sm transition ${active ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]'} disabled:opacity-40`}>
      {children}
    </button>
  );
}

export default function ArticleComposer({
  name = 'content', initialHTML = '', polls = [], quizzes = [],
}: { name?: string; initialHTML?: string; polls?: Opt[]; quizzes?: Opt[] }) {
  const [html, setHtml] = useState(initialHTML);
  const [mode, setMode] = useState<'write' | 'html'>('write');
  const [insertOpen, setInsertOpen] = useState(false);
  const [picking, setPicking] = useState<'poll' | 'quiz' | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false, horizontalRule: {} }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ HTMLAttributes: { class: 'a-figimg' } }),
      Placeholder.configure({ placeholder: 'Write your story… paste it all in, then drop in images, ads, and more with the “Insert” button.' }),
      AdSlot, Spacer, PollEmbed, QuizEmbed, CtaButton, PullQuote, Author,
    ],
    content: initialHTML || '',
    editorProps: { attributes: { class: 'composer-surface prose-article focus:outline-none' } },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  // Close the insert menu on outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => { if (insertRef.current && !insertRef.current.contains(e.target as Node)) { setInsertOpen(false); setPicking(null); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!editor) return <div className="input min-h-[360px] animate-pulse" />;

  const ins = (fn: () => void) => { fn(); setInsertOpen(false); setPicking(null); editor.chain().focus(); };
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (res.ok && editor) editor.chain().focus().setImage({ src: res.url }).run();
    if (fileRef.current) fileRef.current.value = '';
  }
  function toggleHtml() {
    if (mode === 'write') { setHtml(editor!.getHTML()); setMode('html'); }
    else { editor!.commands.setContent(html || '<p></p>'); setMode('write'); }
  }
  function addLink() {
    const prev = editor!.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url.trim() === '') editor!.chain().focus().unsetLink().run();
    else editor!.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  const insertItems = [
    { key: 'image', label: 'Image', icon: <ImageIcon width={16} height={16} />, run: () => fileRef.current?.click() },
    { key: 'ad', label: 'Ad slot', icon: <Megaphone width={16} height={16} />, run: () => editor.chain().focus().insertContent({ type: 'adSlot' }).run() },
    { key: 'divider', label: 'Divider', icon: <Minus width={16} height={16} />, run: () => editor.chain().focus().setHorizontalRule().run() },
    { key: 'spacer', label: 'Blank space', icon: <Rows width={16} height={16} />, run: () => editor.chain().focus().insertContent({ type: 'spacer', attrs: { size: 'md' } }).run() },
    { key: 'pull', label: 'Pull-quote', icon: <Quote width={16} height={16} />, run: () => editor.chain().focus().insertContent({ type: 'pullQuote', content: [{ type: 'text', text: 'Pull a punchy line from your story here.' }] }).run() },
    { key: 'button', label: 'Button', icon: <CursorClick width={16} height={16} />, run: () => editor.chain().focus().insertContent({ type: 'ctaButton', attrs: { label: 'Learn more', href: '' } }).run() },
    { key: 'author', label: 'Author', icon: <Users width={16} height={16} />, run: () => editor.chain().focus().insertContent({ type: 'author', attrs: { name: '', title: '', avatar: '', bio: '', inhouse: false } }).run() },
    { key: 'poll', label: 'Poll', icon: <BarChart width={16} height={16} />, run: () => setPicking('poll') },
    { key: 'quiz', label: 'Pop quiz', icon: <Check width={16} height={16} />, run: () => setPicking('quiz') },
  ];
  const pickList = picking === 'poll' ? polls : quizzes;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {/* Toolbar */}
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--card)]/95 px-2 py-1.5 backdrop-blur">
        {mode === 'write' ? (
          <>
            <TB on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold width={16} height={16} /></TB>
            <TB on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic width={16} height={16} /></TB>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <TB on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading"><H1 width={17} height={17} /></TB>
            <TB on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subheading"><H2 width={17} height={17} /></TB>
            <TB on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bulleted list"><ListBullet width={17} height={17} /></TB>
            <TB on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered width={17} height={17} /></TB>
            <TB on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote width={17} height={17} /></TB>
            <TB on={addLink} active={editor.isActive('link')} title="Link"><LinkIcon width={16} height={16} /></TB>

            {/* Insert element */}
            <div ref={insertRef} className="relative ml-1">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setInsertOpen((o) => !o); setPicking(null); }}
                className="btn-primary btn-sm gap-1"><Plus width={15} height={15} /> Insert</button>
              {insertOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl">
                  {picking ? (
                    <div>
                      <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                        {picking === 'poll' ? 'Choose a poll' : 'Choose a quiz'}
                        <button type="button" onClick={() => setPicking(null)} className="hover:text-[var(--fg)]"><X width={13} height={13} /></button>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {pickList.length === 0 ? <p className="px-2 py-2 text-xs text-[var(--muted)]">None yet — create one first.</p> :
                          pickList.map((o) => (
                            <button key={o.id} type="button"
                              onClick={() => ins(() => editor.chain().focus().insertContent({ type: picking === 'poll' ? 'pollEmbed' : 'quizEmbed', attrs: { id: o.id, label: o.title } }).run())}
                              className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--bg-soft)]">{o.title}</button>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1">
                      {insertItems.map((it) => (
                        <button key={it.key} type="button" onClick={() => (it.key === 'poll' || it.key === 'quiz' || it.key === 'image') ? it.run() : ins(it.run)}
                          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-[var(--bg-soft)]">
                          <span className="text-[var(--muted)]">{it.icon}</span>{it.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button type="button" onClick={toggleHtml} className="ml-auto rounded-lg px-2 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]" title="Edit raw HTML">&lt;/&gt; HTML</button>
          </>
        ) : (
          <>
            <span className="px-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Raw HTML</span>
            <button type="button" onClick={toggleHtml} className="ml-auto btn-primary btn-sm">Done</button>
          </>
        )}
      </div>

      {/* Surface */}
      {mode === 'write' ? (
        <EditorContent editor={editor} className="max-h-[62vh] min-h-[360px] overflow-y-auto px-4 py-4" />
      ) : (
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="min-h-[360px] w-full resize-y bg-[var(--card)] p-4 font-mono text-sm outline-none" />
      )}

      {uploading && <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">Uploading image…</div>}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
      {/* The form submits this. */}
      <textarea name={name} value={html} readOnly hidden />
    </div>
  );
}
