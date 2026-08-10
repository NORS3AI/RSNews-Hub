'use client';
import { useState } from 'react';
import { useComposer } from './context';
import { parsePastedArticle, withAutoAds, blocksToHtml, type ImportBlock } from '@/lib/simpleImport';
import { Sparkles, X, Trash, Megaphone, Plus, Check } from '@/components/icons';

// "Simple upload" — paste a whole article (from Word / Google Docs / email) and
// ship it. We detect the title + byline, split the body into paragraphs, guess
// sub-headings (correctable per-block), and auto-place two ads. On "Add to
// article" it writes the exact same markup the composer produces into the shared
// editor, so the normal Save / Publish flow takes over from there.

function setInput(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.value = value;
  // Let React's uncontrolled inputs + the unsaved-guard notice the change.
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function SimpleUpload() {
  const { editor } = useComposer();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [byline, setByline] = useState('');
  const [blocks, setBlocks] = useState<ImportBlock[]>([]);

  function reset() { setStep('paste'); setRaw(''); setTitle(''); setByline(''); setBlocks([]); }
  function close() { setOpen(false); reset(); }

  function toReview() {
    const p = parsePastedArticle(raw);
    setTitle(p.title);
    setByline(p.byline);
    setBlocks(withAutoAds(p.blocks));
    setStep('review');
  }

  const setKind = (i: number, kind: 'p' | 'h') =>
    setBlocks((b) => b.map((x, j) => (j === i ? { ...x, kind } : x)));
  const removeAt = (i: number) => setBlocks((b) => b.filter((_, j) => j !== i));
  const insertAdAfter = (i: number) =>
    setBlocks((b) => [...b.slice(0, i + 1), { kind: 'ad', size: 'wide' } as ImportBlock, ...b.slice(i + 1)]);

  const adCount = blocks.filter((b) => b.kind === 'ad').length;

  function addToArticle() {
    if (!editor) return;
    const hasContent = editor.getText().trim().length > 0;
    if (hasContent && !window.confirm('This will replace what is currently in the editor. Continue?')) return;
    editor.commands.setContent(blocksToHtml(blocks) || '<p></p>');
    if (title.trim()) setInput('title', title.trim());
    if (byline.trim()) setInput('byline', byline.trim());
    close();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="btn-outline btn-sm mb-3 w-full gap-2 border-brand-300 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30">
        <Sparkles width={15} height={15} /> Simple upload — paste from Word
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/60 p-3 py-[4vh] backdrop-blur-sm" onClick={close}>
          <div className="w-full max-w-[760px] overflow-hidden rounded-2xl bg-[var(--card)] text-[var(--fg)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3.5">
              <Sparkles width={18} height={18} className="text-brand-600" />
              <h2 className="text-lg font-bold">Simple upload</h2>
              <span className="text-sm text-[var(--muted)]">{step === 'paste' ? 'Step 1 — paste your document' : 'Step 2 — quick check'}</span>
              <button type="button" onClick={close} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--bg-soft)]"><X width={18} height={18} /></button>
            </div>

            {step === 'paste' ? (
              <div className="px-5 py-5">
                <p className="mb-3 text-sm text-[var(--muted)]">
                  Paste everything from your Word doc, Google Doc or email. Put the <b>headline on the first line</b>, and a <b>&ldquo;By Name&rdquo;</b> line under it if you have one — we&apos;ll sort out the rest.
                </p>
                <textarea autoFocus value={raw} onChange={(e) => setRaw(e.target.value)} rows={14}
                  placeholder={'USPS Announces Emergency Rate Change\nBy Jane Smith\n\nThe Postal Service said today that…\n\nWhat This Means\nFor store owners, the change…'}
                  className="input w-full resize-y font-mono text-sm leading-relaxed" />
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button type="button" onClick={close} className="btn-outline btn-sm">Cancel</button>
                  <button type="button" onClick={toReview} disabled={!raw.trim()} className="btn-primary btn-sm gap-1.5 disabled:opacity-50">
                    Continue <Check width={15} height={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-h-[74vh] overflow-y-auto px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className="input font-bold" placeholder="Headline" />
                  </div>
                  <div>
                    <label className="label">By (author)</label>
                    <input value={byline} onChange={(e) => setByline(e.target.value)} className="input" placeholder="Optional — defaults to you" />
                  </div>
                </div>

                <div className="mt-5 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Body — tap a block to make it a sub-heading</span>
                  <span className="text-xs text-[var(--muted)]">{adCount} ad{adCount === 1 ? '' : 's'} placed</span>
                </div>

                <div className="space-y-1.5">
                  {blocks.length === 0 && <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted)]">No body text detected. Go back and paste your article.</p>}
                  {blocks.map((b, i) => (
                    <div key={i}>
                      {b.kind === 'ad' ? (
                        <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm dark:border-brand-900 dark:bg-brand-950/30">
                          <Megaphone width={14} height={14} className="text-brand-600" />
                          <span className="font-semibold text-brand-700 dark:text-brand-300">Ad slot</span>
                          <span className="text-xs text-[var(--muted)]">Auto — best match, competitor-safe</span>
                          <button type="button" onClick={() => removeAt(i)} title="Remove ad" className="ml-auto grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash width={14} height={14} /></button>
                        </div>
                      ) : (
                        <div className={`flex items-start gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 ${b.kind === 'h' ? 'bg-[var(--bg-soft)]' : ''}`}>
                          <div className="flex shrink-0 overflow-hidden rounded-md border border-[var(--border)]">
                            <button type="button" onClick={() => setKind(i, 'p')} className={`px-2 py-1 text-xs font-bold ${b.kind === 'p' ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`} title="Paragraph">¶</button>
                            <button type="button" onClick={() => setKind(i, 'h')} className={`px-2 py-1 text-xs font-bold ${b.kind === 'h' ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`} title="Sub-heading">H</button>
                          </div>
                          <p className={`min-w-0 flex-1 ${b.kind === 'h' ? 'text-lg font-extrabold leading-snug' : 'text-sm text-[var(--fg)]'}`}>{b.text}</p>
                        </div>
                      )}
                      {/* Insert-ad divider (skip after the very last block) */}
                      {i < blocks.length - 1 && (
                        <div className="group flex justify-center py-0.5">
                          <button type="button" onClick={() => insertAdAfter(i)}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)] opacity-0 transition hover:bg-brand-50 hover:text-brand-600 group-hover:opacity-100 dark:hover:bg-brand-950/30">
                            <Plus width={11} height={11} /> Ad here
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <button type="button" onClick={() => setStep('paste')} className="btn-outline btn-sm">← Back</button>
                  <button type="button" onClick={addToArticle} disabled={!title.trim() || blocks.length === 0} className="btn-primary btn-sm gap-1.5 disabled:opacity-50">
                    <Check width={15} height={15} /> Add to article
                  </button>
                </div>
                <p className="mt-2 text-right text-xs text-[var(--muted)]">Then pick a category, set Breaking if needed, and Save.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
