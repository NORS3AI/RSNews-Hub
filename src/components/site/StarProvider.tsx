'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type SavedItem = { id: string; title: string; slug: string };
export type HistoryItem = SavedItem & { ts: number };
// A clipping is either a highlighted quote (turned into a quote image) or a
// saved comic image. `kind` distinguishes them; quote fields are empty for comics.
export type Clipping = {
  id: string; ts: number; title: string;
  kind?: 'quote' | 'comic';
  quote?: string; author?: string | null; slug?: string; image?: string | null;
};

type Ctx = {
  favorites: SavedItem[];
  toRead: SavedItem[];
  history: HistoryItem[];
  clippings: Clipping[];
  isFavorite: (id: string) => boolean;
  isToRead: (id: string) => boolean;
  toggleFavorite: (s: SavedItem) => void;
  toggleToRead: (s: SavedItem) => void;
  removeToRead: (id: string) => void;
  recordHistory: (s: SavedItem) => void;
  clearHistory: () => void;
  addClipping: (c: Omit<Clipping, 'id' | 'ts'>) => void;
  removeClipping: (id: string) => void;
  ready: boolean;
};

const Ctx = createContext<Ctx | null>(null);
const FAV_KEY = 'rsnews_favorites_v1';
const READ_KEY = 'rsnews_toread_v1';
const HIST_KEY = 'rsnews_history_v1';
const CLIP_KEY = 'rsnews_clippings_v1';
const HIST_MAX = 50;

function load<T = SavedItem[]>(key: string): T {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return [] as unknown as T; }
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota */ } }

// Favorites, to-read and clippings are stored PER ACCOUNT on the server when the
// visitor is a signed-in member (so they follow them across devices), with the
// browser copy kept as a fast local cache. Anonymous visitors are local-only.
// History stays local-only (it's ephemeral UI; reading is also logged server-side).
export function StarProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [toRead, setToRead] = useState<SavedItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [clippings, setClippings] = useState<Clipping[]>([]);
  const [ready, setReady] = useState(false);
  const serverBacked = useRef(false);

  // Apply an authoritative server bundle to state + local cache.
  const applyBundle = useCallback((b: { favorites?: SavedItem[]; toRead?: SavedItem[]; clippings?: Clipping[] }) => {
    if (b.favorites) { setFavorites(b.favorites); save(FAV_KEY, b.favorites); }
    if (b.toRead) { setToRead(b.toRead); save(READ_KEY, b.toRead); }
    if (b.clippings) { setClippings(b.clippings); save(CLIP_KEY, b.clippings); }
  }, []);

  // Push a mutation to the server (when signed in) and adopt the returned bundle.
  const pushOp = useCallback((payload: Record<string, unknown>) => {
    if (!serverBacked.current) return;
    fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (b) applyBundle(b); })
      .catch(() => { /* keep the optimistic local state */ });
  }, [applyBundle]);

  useEffect(() => {
    // 1) Local-first: show cached items instantly.
    setFavorites(load(FAV_KEY));
    setToRead(load(READ_KEY));
    setHistory(load<HistoryItem[]>(HIST_KEY));
    setClippings(load<Clipping[]>(CLIP_KEY));
    setReady(true);

    // 2) If signed in, reconcile with the server (merging local items the first time).
    fetch('/api/saved')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.signedIn) return; // anonymous → stay local-only
        serverBacked.current = true;
        const localFav = load<SavedItem[]>(FAV_KEY), localRead = load<SavedItem[]>(READ_KEY), localClip = load<Clipping[]>(CLIP_KEY);
        const serverEmpty = !data.favorites.length && !data.toRead.length && !data.clippings.length;
        const haveLocal = localFav.length || localRead.length || localClip.length;
        if (serverEmpty && haveLocal) {
          fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'merge', local: { favorites: localFav, toRead: localRead, clippings: localClip } }) })
            .then((r) => (r.ok ? r.json() : null)).then((b) => b && applyBundle(b)).catch(() => {});
        } else {
          applyBundle(data); // server is the source of truth
        }
      })
      .catch(() => { /* offline / error → local-only */ });

    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY) setFavorites(load(FAV_KEY));
      if (e.key === READ_KEY) setToRead(load(READ_KEY));
      if (e.key === HIST_KEY) setHistory(load<HistoryItem[]>(HIST_KEY));
      if (e.key === CLIP_KEY) setClippings(load<Clipping[]>(CLIP_KEY));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyBundle]);

  const persist = useCallback((key: string, next: SavedItem[], setter: (v: SavedItem[]) => void) => {
    setter(next);
    save(key, next);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some((s) => s.id === id), [favorites]);
  const isToRead = useCallback((id: string) => toRead.some((s) => s.id === id), [toRead]);

  const toggleFavorite = useCallback((s: SavedItem) => {
    persist(FAV_KEY, isFavorite(s.id) ? favorites.filter((x) => x.id !== s.id)
      : [{ id: s.id, title: s.title, slug: s.slug }, ...favorites], setFavorites);
    pushOp({ op: 'toggleFavorite', item: s });
  }, [favorites, isFavorite, persist, pushOp]);

  const toggleToRead = useCallback((s: SavedItem) => {
    persist(READ_KEY, isToRead(s.id) ? toRead.filter((x) => x.id !== s.id)
      : [{ id: s.id, title: s.title, slug: s.slug }, ...toRead], setToRead);
    pushOp({ op: 'toggleToRead', item: s });
  }, [toRead, isToRead, persist, pushOp]);

  const removeToRead = useCallback((id: string) => {
    persist(READ_KEY, toRead.filter((x) => x.id !== id), setToRead);
    pushOp({ op: 'removeToRead', id });
  }, [toRead, persist, pushOp]);

  // History: most-recent first, de-duplicated, capped. Local-only (see note above).
  const recordHistory = useCallback((s: SavedItem) => {
    setHistory((prev) => {
      const next = [{ id: s.id, title: s.title, slug: s.slug, ts: Date.now() },
        ...prev.filter((x) => x.id !== s.id)].slice(0, HIST_MAX);
      save(HIST_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => { setHistory([]); save(HIST_KEY, []); }, []);

  const addClipping = useCallback((c: Omit<Clipping, 'id' | 'ts'>) => {
    const full: Clipping = { ...c, id: 'c' + Date.now(), ts: Date.now() };
    setClippings((prev) => { const next = [full, ...prev].slice(0, 200); save(CLIP_KEY, next); return next; });
    pushOp({ op: 'addClipping', clipping: full });
  }, [pushOp]);

  const removeClipping = useCallback((id: string) => {
    setClippings((prev) => { const next = prev.filter((c) => c.id !== id); save(CLIP_KEY, next); return next; });
    pushOp({ op: 'removeClipping', id });
  }, [pushOp]);

  return (
    <Ctx.Provider value={{ favorites, toRead, history, clippings, isFavorite, isToRead, toggleFavorite, toggleToRead, removeToRead, recordHistory, clearHistory, addClipping, removeClipping, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSaved must be used within StarProvider');
  return ctx;
}
