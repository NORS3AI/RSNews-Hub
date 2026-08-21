'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  saveNewsroomDoc, deleteNewsroomDoc,
  addNewsroomComment, deleteNewsroomComment, pushNewsroomDocToArticle, newsroomSync, toggleNewsroomFlag,
} from '@/lib/actions';
import { AUTOSAVE_MS, HEARTBEAT_MS, locateQuote, type NewsroomDocView, type NewsroomViewer, type NewsroomCommentView, type NewsroomFlaggedDraft } from '@/lib/newsroom';
import type { HouseStyleRule } from '@/lib/houseStyle';
import StyleCheck from './StyleCheck';
import { ArrowLeft, Trash, X, Check, ArrowRight, Users, Star, StarFilled } from '@/components/icons';

type Me = { id: string; name: string };
type Anchor = { start: number; end: number; text: string };

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function fmtTime(iso: string | null, mounted: boolean): string {
  if (!iso || !mounted) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function ViewerChip({ v, me }: { v: NewsroomViewer; me: Me }) {
  const isMe = v.userId === me.id;
  return (
    <span title={`${isMe ? 'You' : v.userName}${v.editing ? ' — editing' : ''}`}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${v.editing ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' : 'bg-brand-600/15 text-brand-700 dark:text-brand-300'}`}>
      {initials(v.userName)}
    </span>
  );
}

export default function DocEditor({ doc, me, styleRules, flagged: flaggedInit, flaggedDrafts }: { doc: NewsroomDocView; me: Me; styleRules: HouseStyleRule[]; flagged: boolean; flaggedDrafts: NewsroomFlaggedDraft[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [comments, setComments] = useState<NewsroomCommentView[]>(doc.comments);
  const [createdByName] = useState(doc.createdByName);
  const [flagged, setFlagged] = useState(flaggedInit);
  const [pins, setPins] = useState<NewsroomFlaggedDraft[]>(flaggedDrafts);
  const [flagBusy, setFlagBusy] = useState(false);
  const [viewers, setViewers] = useState<NewsroomViewer[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [stale, setStale] = useState<NewsroomDocView | null>(null);
  const [commentText, setCommentText] = useState('');
  const [anchor, setAnchor] = useState<Anchor | null>(null);   // the passage a new note will attach to
  const [busy, startBusy] = useTransition();
  const [mounted, setMounted] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef(title); titleRef.current = title;
  const bodyValRef = useRef(body); bodyValRef.current = body;
  const dirtyRef = useRef(false);
  const baseRef = useRef<string>(doc.updatedAt);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while we're intentionally pushing/deleting this doc, so the sync loop
  // doesn't see the doc "vanish" (pushedAt just set) and race us to the list.
  const leavingRef = useRef(false);
  const id = doc.id;

  useEffect(() => { setMounted(true); }, []);

  // Ref so a mid-save reschedule can call the latest runSave without a dep cycle.
  const runSaveRef = useRef<() => void>(() => {});
  const runSave = useCallback(async () => {
    // Snapshot what we're saving. If more keystrokes land while the request is in
    // flight, we must NOT clear the dirty flag (that would let the sync loop adopt
    // the server copy and drop those keystrokes) — instead keep it dirty and save
    // again once this one returns.
    const savedTitle = titleRef.current, savedBody = bodyValRef.current;
    setSaving(true);
    try {
      const res = await saveNewsroomDoc({ id, title: savedTitle, body: savedBody });
      baseRef.current = res.at;
      if (titleRef.current === savedTitle && bodyValRef.current === savedBody) {
        dirtyRef.current = false;
        setSavedAt(res.at);
      } else {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => runSaveRef.current(), AUTOSAVE_MS);
      }
    } catch { /* transient — retried on next edit/heartbeat */ }
    setSaving(false);
  }, [id]);
  runSaveRef.current = runSave;

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(runSave, AUTOSAVE_MS);
  }, [runSave]);

  const onEditBody = (v: string) => { dirtyRef.current = true; setBody(v); scheduleSave(); };
  const onEditTitle = (v: string) => { dirtyRef.current = true; setTitle(v); scheduleSave(); };

  // Track the current selection in the draft so a note can attach to it.
  const captureSelection = () => {
    const el = bodyRef.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    if (e > s) setAnchor({ start: s, end: e, text: el.value.slice(s, e).slice(0, 500) });
  };

  // Heartbeat + live sync for this one doc.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await newsroomSync({ docId: id, editing: dirtyRef.current });
        if (cancelled) return;
        setViewers(res.viewers);
        const sd = res.doc;
        if (!sd) { if (!leavingRef.current) router.push('/admin/newsroom'); return; } // pushed/deleted elsewhere (but not by our own push)
        setComments(sd.comments);
        if (dirtyRef.current) {
          if (sd.updatedById && sd.updatedById !== me.id && sd.updatedAt > baseRef.current) setStale(sd);
        } else {
          // Not editing — adopt the server copy so a co-editor's changes appear.
          setBody(sd.body); setTitle(sd.title); baseRef.current = sd.updatedAt; setStale(null);
        }
      } catch { /* offline blip */ }
    };
    tick();
    const iv = setInterval(tick, HEARTBEAT_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [id, me.id, router]);

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const a = anchor;
    startBusy(async () => {
      const c = await addNewsroomComment({ docId: id, body: text, quote: a?.text ?? null, quoteStart: a?.start ?? null });
      setComments((prev) => [...prev, c]);
      setCommentText(''); setAnchor(null);
    });
  };
  const removeComment = (cid: string) => startBusy(async () => {
    await deleteNewsroomComment(cid);
    setComments((prev) => prev.filter((c) => c.id !== cid));
  });

  // Click a note → re-select the passage it was written about and scroll to it.
  const jumpToQuote = (c: NewsroomCommentView) => {
    const range = locateQuote(bodyValRef.current, c.quote, c.quoteStart);
    const el = bodyRef.current;
    if (!range || !el) return;
    el.focus();
    el.setSelectionRange(range.start, range.end);
    // Approximate scroll: put the anchored line near the top of the textarea.
    const line = bodyValRef.current.slice(0, range.start).split('\n').length;
    const lineH = parseFloat(getComputedStyle(el).lineHeight) || 22;
    el.scrollTop = Math.max(0, (line - 2) * lineH);
  };

  const reloadStale = () => {
    if (!stale) return;
    setBody(stale.body); setTitle(stale.title); setComments(stale.comments);
    dirtyRef.current = false; baseRef.current = stale.updatedAt; setStale(null);
  };

  const pushToEditor = () => {
    if (!confirm(`Push “${title}” to the article editor? It becomes a draft article and leaves the Newsroom.`)) return;
    leavingRef.current = true; // we're driving the navigation — don't let the sync loop redirect us to the list first
    startBusy(async () => {
      try {
        if (dirtyRef.current) await saveNewsroomDoc({ id, title, body });
        const articleId = await pushNewsroomDocToArticle(id);
        router.push(`/admin/articles/${articleId}`);
      } catch { leavingRef.current = false; /* push failed — stay put */ }
    });
  };
  const remove = () => {
    if (!confirm(`Delete “${title}”? This can’t be undone.`)) return;
    leavingRef.current = true;
    startBusy(async () => { await deleteNewsroomDoc(id); router.push('/admin/newsroom'); });
  };

  // Pin/unpin this draft to my personal switcher. Optimistic: flip the star and
  // add/remove this doc from the rail immediately, then persist.
  const toggleFlag = async () => {
    if (flagBusy) return;
    setFlagBusy(true);
    const next = !flagged;
    setFlagged(next);
    setPins((prev) => next
      ? (prev.some((p) => p.id === id) ? prev : [{ id, title: titleRef.current, updatedAt: new Date().toISOString() }, ...prev])
      : prev.filter((p) => p.id !== id));
    try { const server = await toggleNewsroomFlag(id); setFlagged(server); }
    catch { setFlagged(!next); /* revert */ }
    finally { setFlagBusy(false); }
  };

  // The switcher rail: my flagged drafts, current one first + highlighted. Uses the
  // live title for the current doc so a rename shows without a round-trip.
  const railItems = pins.map((p) => (p.id === id ? { ...p, title: title || 'Untitled draft' } : p));
  const otherPins = railItems.filter((p) => p.id !== id);

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/newsroom" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
          <ArrowLeft width={15} height={15} /> All drafts
        </Link>
        <div className="flex items-center gap-3">
          {createdByName && <span className="text-xs text-[var(--muted)]">Started by <b className="text-[var(--fg)]">{createdByName}</b></span>}
          <button type="button" onClick={toggleFlag} disabled={flagBusy} aria-pressed={flagged}
            title={flagged ? 'Unpin from your switcher' : 'Pin to your switcher — flip between your drafts fast'}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${flagged ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
            {flagged ? <StarFilled width={14} height={14} /> : <Star width={14} height={14} />}
            {flagged ? 'Pinned' : 'Pin'}
          </button>
        </div>
      </div>

      {/* Quick-switcher: my flagged drafts. Flip between in-progress stories without
          backing out to the list. Current draft is shown first, highlighted. */}
      {(otherPins.length > 0 || flagged) && (
        <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-2 py-1.5">
          <span className="inline-flex shrink-0 items-center gap-1 pl-1 pr-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]"><StarFilled width={12} height={12} className="text-amber-500" /> Pinned</span>
          {flagged && (
            <span className="inline-flex max-w-[200px] shrink-0 items-center rounded-lg border border-brand-400 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
              <span className="truncate">{title || 'Untitled draft'}</span>
            </span>
          )}
          {otherPins.map((p) => (
            <Link key={p.id} href={`/admin/newsroom/${p.id}`}
              className="inline-flex max-w-[200px] shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] hover:border-brand-400 hover:bg-brand-500/5">
              <span className="truncate">{p.title || 'Untitled draft'}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Editor */}
        <div className="space-y-3">
          {stale && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <span className="text-amber-900 dark:text-amber-200"><b>{stale.updatedByName || 'Someone'}</b> edited this draft. Reload to see their version (you&apos;ll lose your unsaved changes).</span>
              <button type="button" className="btn-outline btn-sm shrink-0" onClick={reloadStale}>Reload</button>
            </div>
          )}
          <input value={title} onChange={(e) => onEditTitle(e.target.value)} placeholder="Untitled draft"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xl font-bold outline-none focus:border-brand-500" />
          <textarea ref={bodyRef} value={body} onChange={(e) => onEditBody(e.target.value)}
            onSelect={captureSelection} onMouseUp={captureSelection} onKeyUp={captureSelection}
            placeholder="Start writing the story here…" spellCheck
            className="min-h-[46vh] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-[15px] leading-relaxed outline-none focus:border-brand-500" />
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>{words ? `${words} words` : 'Empty draft'}</span>
            <span aria-live="polite">{saving ? 'Saving…' : savedAt ? `Saved ${fmtTime(savedAt, mounted)}` : ' '}</span>
          </div>
          <StyleCheck text={body} rules={styleRules} onChange={onEditBody} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]"><Users width={13} height={13} /> Here now</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {viewers.length ? viewers.map((v) => <ViewerChip key={v.userId} v={v} me={me} />) : <span className="text-xs text-[var(--muted)]">Just you</span>}
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Last edited {doc.updatedByName ? `by ${doc.updatedByName} ` : ''}{fmtTime(savedAt ?? doc.updatedAt, mounted)}.</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className="btn-primary btn-sm justify-center" disabled={busy} onClick={pushToEditor}>Push to article editor <ArrowRight width={14} height={14} /></button>
              <button type="button" className="btn-outline btn-sm justify-center text-red-600" disabled={busy} onClick={remove}><Trash width={13} height={13} /> Delete draft</button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Notes ({comments.length})</div>
            <div className="mt-2 max-h-[34vh] space-y-2 overflow-y-auto">
              {comments.length === 0 && <p className="text-xs text-[var(--muted)]">No notes yet. Highlight a passage in the draft, then leave a note — your name is added automatically.</p>}
              {comments.map((c) => (
                <div key={c.id} className="group rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{c.authorName}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[var(--muted)]">{fmtTime(c.createdAt, mounted)}</span>
                      <button type="button" title="Delete note" onClick={() => removeComment(c.id)}
                        className="text-[var(--muted)] opacity-0 transition hover:text-red-600 group-hover:opacity-100"><X width={12} height={12} /></button>
                    </div>
                  </div>
                  {c.quote && (
                    <button type="button" onClick={() => jumpToQuote(c)} title="Jump to the highlighted passage"
                      className="mt-1 block w-full truncate border-l-2 border-brand-400 bg-brand-500/5 px-2 py-0.5 text-left text-[11px] italic text-[var(--muted)] hover:bg-brand-500/10">
                      &ldquo;{c.quote}&rdquo;
                    </button>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              ))}
            </div>
            {anchor && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-brand-300 bg-brand-500/5 px-2 py-1 text-[11px] text-[var(--muted)]">
                <span className="min-w-0 flex-1 truncate italic">Attaching to: &ldquo;{anchor.text}&rdquo;</span>
                <button type="button" onClick={() => setAnchor(null)} title="Don't attach" className="shrink-0 hover:text-red-600"><X width={12} height={12} /></button>
              </div>
            )}
            <div className="mt-2 flex items-start gap-2">
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); } }}
                placeholder={anchor ? 'Note about the highlighted passage…' : 'Add a note…'} rows={2}
                className="min-h-[38px] flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
              <button type="button" className="btn-primary btn-sm" disabled={busy || !commentText.trim()} onClick={submitComment} title="Add note (⌘/Ctrl+Enter)"><Check width={14} height={14} /></button>
            </div>
            <p className="mt-1 text-[10px] text-[var(--muted)]">Tip: select text in the draft first to attach your note to that spot.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
