'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createNewsroomDoc, saveNewsroomDoc, deleteNewsroomDoc,
  addNewsroomComment, deleteNewsroomComment, pushNewsroomDocToArticle, newsroomSync,
} from '@/lib/actions';
import { AUTOSAVE_MS, HEARTBEAT_MS, type NewsroomDocView, type NewsroomViewer } from '@/lib/newsroom';
import StyleCheck from './StyleCheck';
import { Plus, Trash, X, Check, ArrowRight, Users, FileText } from '@/components/icons';

type Me = { id: string; name: string };

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

// A small round presence chip (initials). Ringed while the viewer is actively typing.
function ViewerChip({ v, me }: { v: NewsroomViewer; me: Me }) {
  const isMe = v.userId === me.id;
  return (
    <span
      title={`${isMe ? 'You' : v.userName}${v.editing ? ' — editing' : ''}`}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
        v.editing ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' : 'bg-brand-600/15 text-brand-700 dark:text-brand-300'
      }`}
    >
      {initials(v.userName)}
    </span>
  );
}

export default function Newsroom({ initialDocs, me }: { initialDocs: NewsroomDocView[]; me: Me }) {
  const router = useRouter();
  const [docs, setDocs] = useState<NewsroomDocView[]>(initialDocs);
  const [activeId, setActiveId] = useState<string | null>(initialDocs[0]?.id ?? null);
  const [viewers, setViewers] = useState<NewsroomViewer[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [stale, setStale] = useState<NewsroomDocView | null>(null);
  const [commentText, setCommentText] = useState('');
  const [busy, startBusy] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Refs so the heartbeat + autosave timers always read the latest values.
  const docsRef = useRef(docs); docsRef.current = docs;
  const activeIdRef = useRef(activeId); activeIdRef.current = activeId;
  const meRef = useRef(me); meRef.current = me;
  const dirtyRef = useRef(false);
  const activeBaseRef = useRef<string>(initialDocs[0]?.updatedAt ?? '');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = docs.find((d) => d.id === activeId) ?? null;

  useEffect(() => { setMounted(true); }, []);

  const runSave = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    const doc = docsRef.current.find((d) => d.id === id);
    if (!doc) return;
    setSaving(true);
    try {
      const res = await saveNewsroomDoc({ id, title: doc.title, body: doc.body });
      dirtyRef.current = false;
      setSavedAt(res.at);
      activeBaseRef.current = res.at; // my own save is the new "last seen" baseline
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, updatedAt: res.at, updatedById: meRef.current.id, updatedByName: meRef.current.name } : d)));
    } catch { /* transient — the next keystroke or heartbeat retries */ }
    setSaving(false);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(runSave, AUTOSAVE_MS);
  }, [runSave]);

  const editActive = (patch: Partial<NewsroomDocView>) => {
    if (!activeId) return;
    dirtyRef.current = true;
    setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, ...patch } : d)));
    scheduleSave();
  };

  // Heartbeat + live sync (presence, others' drafts, new notes). Runs once.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await newsroomSync({ docId: activeIdRef.current ?? undefined, editing: dirtyRef.current });
        if (cancelled) return;
        setViewers(res.viewers);
        const aId = activeIdRef.current;
        const server = res.docs;
        const byId = new Map(server.map((d) => [d.id, d] as const));
        // Server is source of truth for the list + every doc EXCEPT the one I'm
        // actively editing (keep my unsaved title/body there; take server comments).
        setDocs((prev) => server.map((sd) => {
          if (sd.id === aId && dirtyRef.current) {
            const local = prev.find((d) => d.id === aId);
            return local ? { ...sd, title: local.title, body: local.body } : sd;
          }
          return sd;
        }));
        if (aId && dirtyRef.current) {
          const sd = byId.get(aId);
          if (sd && sd.updatedById && sd.updatedById !== meRef.current.id && sd.updatedAt > activeBaseRef.current) setStale(sd);
        } else {
          const sd = aId ? byId.get(aId) : undefined;
          if (sd) activeBaseRef.current = sd.updatedAt;
          setStale(null);
        }
        if (aId && !byId.has(aId)) setActiveId(server[0]?.id ?? null); // active doc was pushed/deleted elsewhere
      } catch { /* offline blip — try again next tick */ }
    };
    tick();
    const iv = setInterval(tick, HEARTBEAT_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const selectDoc = (id: string) => {
    if (id === activeIdRef.current) return;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (dirtyRef.current) void runSave(); // flush the doc I'm leaving
    dirtyRef.current = false;
    setStale(null);
    setSavedAt(null);
    setActiveId(id);
    activeBaseRef.current = docsRef.current.find((d) => d.id === id)?.updatedAt ?? '';
  };

  const newDraft = () => startBusy(async () => {
    const id = await createNewsroomDoc();
    const at = new Date().toISOString();
    setDocs((prev) => [{ id, title: 'Untitled draft', body: '', updatedAt: at, updatedById: me.id, updatedByName: me.name, createdByName: me.name, comments: [] }, ...prev]);
    dirtyRef.current = false;
    activeBaseRef.current = at;
    setSavedAt(null);
    setActiveId(id);
  });

  const removeDraft = (id: string) => {
    const d = docsRef.current.find((x) => x.id === id);
    if (!confirm(`Delete “${d?.title || 'this draft'}”? This can’t be undone.`)) return;
    startBusy(async () => {
      await deleteNewsroomDoc(id);
      setDocs((prev) => {
        const next = prev.filter((x) => x.id !== id);
        if (activeIdRef.current === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    });
  };

  const pushToEditor = (id: string) => {
    const d = docsRef.current.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Push “${d.title}” to the article editor? It becomes a draft article and leaves the Newsroom.`)) return;
    startBusy(async () => {
      if (dirtyRef.current && activeIdRef.current === id) await saveNewsroomDoc({ id, title: d.title, body: d.body });
      const articleId = await pushNewsroomDocToArticle(id);
      router.push(`/admin/articles/${articleId}`);
    });
  };

  const submitComment = () => {
    const body = commentText.trim();
    if (!body || !activeId) return;
    const docId = activeId;
    startBusy(async () => {
      const c = await addNewsroomComment({ docId, body });
      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, comments: [...d.comments, c] } : d)));
      setCommentText('');
    });
  };
  const removeComment = (docId: string, cid: string) => startBusy(async () => {
    await deleteNewsroomComment(cid);
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, comments: d.comments.filter((c) => c.id !== cid) } : d)));
  });

  const reloadStale = () => {
    if (!stale) return;
    editActiveReplace(stale);
  };
  const editActiveReplace = (sd: NewsroomDocView) => {
    setDocs((prev) => prev.map((d) => (d.id === sd.id ? sd : d)));
    dirtyRef.current = false;
    activeBaseRef.current = sd.updatedAt;
    setStale(null);
  };

  if (docs.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
        <FileText width={28} height={28} className="text-[var(--muted)]" />
        <p className="mt-3 max-w-sm text-sm text-[var(--muted)]">No drafts yet. Start one and anyone with admin can jump in and write alongside you.</p>
        <button type="button" className="btn-primary btn-sm mt-4" disabled={busy} onClick={newDraft}><Plus width={14} height={14} /> New draft</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tab strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {docs.map((d) => {
          const on = d.id === activeId;
          return (
            <button key={d.id} type="button" onClick={() => selectDoc(d.id)}
              className={`group flex max-w-[220px] shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-sm transition ${
                on ? 'border-brand-600 bg-[var(--card)] font-semibold' : 'border-transparent text-[var(--muted)] hover:bg-[var(--bg-soft)]'
              }`}>
              <span className="truncate">{d.title || 'Untitled draft'}</span>
              {d.comments.length > 0 && <span className="badge bg-[var(--bg-soft)] text-[10px] text-[var(--muted)]">{d.comments.length}</span>}
            </button>
          );
        })}
        <button type="button" onClick={newDraft} disabled={busy} title="New draft"
          className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-2 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]">
          <Plus width={15} height={15} />
        </button>
      </div>

      {active && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Editor */}
          <div className="space-y-3">
            {stale && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                <span className="text-amber-900 dark:text-amber-200"><b>{stale.updatedByName || 'Someone'}</b> edited this draft. Reload to see their version (you&apos;ll lose your unsaved changes).</span>
                <button type="button" className="btn-outline btn-sm shrink-0" onClick={reloadStale}>Reload</button>
              </div>
            )}
            <input
              value={active.title}
              onChange={(e) => editActive({ title: e.target.value })}
              placeholder="Untitled draft"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xl font-bold outline-none focus:border-brand-500"
            />
            <textarea
              value={active.body}
              onChange={(e) => editActive({ body: e.target.value })}
              placeholder="Start writing the story here…"
              spellCheck
              className="min-h-[46vh] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-[15px] leading-relaxed outline-none focus:border-brand-500"
            />
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{active.body.trim() ? `${active.body.trim().split(/\s+/).length} words` : 'Empty draft'}</span>
              <span aria-live="polite">{saving ? 'Saving…' : savedAt ? `Saved ${fmtTime(savedAt, mounted)}` : dirtyRef.current ? 'Unsaved' : ' '}</span>
            </div>
            <StyleCheck text={active.body} onChange={(t) => editActive({ body: t })} />
          </div>

          {/* Sidebar: presence + actions + comments */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]"><Users width={13} height={13} /> Here now</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {viewers.length ? viewers.map((v) => <ViewerChip key={v.userId} v={v} me={me} />) : <span className="text-xs text-[var(--muted)]">Just you</span>}
              </div>
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                Last edited {active.updatedByName ? `by ${active.updatedByName} ` : ''}{fmtTime(active.updatedAt, mounted)}.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" className="btn-primary btn-sm justify-center" disabled={busy} onClick={() => pushToEditor(active.id)}>
                  Push to article editor <ArrowRight width={14} height={14} />
                </button>
                <button type="button" className="btn-outline btn-sm justify-center text-red-600" disabled={busy} onClick={() => removeDraft(active.id)}>
                  <Trash width={13} height={13} /> Delete draft
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Notes ({active.comments.length})</div>
              <div className="mt-2 max-h-[34vh] space-y-2 overflow-y-auto">
                {active.comments.length === 0 && <p className="text-xs text-[var(--muted)]">No notes yet. Leave a note for whoever picks this up — your name is added automatically.</p>}
                {active.comments.map((c) => (
                  <div key={c.id} className="group rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{c.authorName}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--muted)]">{fmtTime(c.createdAt, mounted)}</span>
                        <button type="button" title="Delete note" onClick={() => removeComment(active.id, c.id)}
                          className="text-[var(--muted)] opacity-0 transition hover:text-red-600 group-hover:opacity-100"><X width={12} height={12} /></button>
                      </div>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-start gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); } }}
                  placeholder="Add a note…"
                  rows={2}
                  className="min-h-[38px] flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                />
                <button type="button" className="btn-primary btn-sm" disabled={busy || !commentText.trim()} onClick={submitComment} title="Add note (⌘/Ctrl+Enter)">
                  <Check width={14} height={14} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
