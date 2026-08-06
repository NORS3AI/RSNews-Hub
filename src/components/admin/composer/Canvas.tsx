'use client';
import { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { useComposer } from './context';
import { Bold, Italic, LinkIcon } from '@/components/icons';

// Small text-formatting toolbar button (selection-based bits live here; block
// elements live in the left palette).
function TB({ on, active, title, children }: { on: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`grid h-8 w-8 place-items-center rounded-lg transition ${active ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]'}`}>
      {children}
    </button>
  );
}

export default function Canvas({ initialTitle = '' }: { initialTitle?: string }) {
  const { editor, html } = useComposer();
  const [mode, setMode] = useState<'write' | 'html'>('write');
  const [raw, setRaw] = useState(html);
  if (!editor) return <div className="input min-h-[420px] animate-pulse" />;

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
              <span className="ml-1 text-xs text-[var(--muted)]">Select text to format · headings &amp; lists are on the left</span>
              <button type="button" onClick={openHtml} className="ml-auto rounded-lg px-2 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]">&lt;/&gt; HTML</button>
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
    </div>
  );
}
