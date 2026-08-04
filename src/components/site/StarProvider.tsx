'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

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

function load(key: string): SavedItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [toRead, setToRead] = useState<SavedItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [clippings, setClippings] = useState<Clipping[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(load(FAV_KEY));
    setToRead(load(READ_KEY));
    setHistory(load(HIST_KEY) as HistoryItem[]);
    setClippings(load(CLIP_KEY) as Clipping[]);
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY) setFavorites(load(FAV_KEY));
      if (e.key === READ_KEY) setToRead(load(READ_KEY));
      if (e.key === HIST_KEY) setHistory(load(HIST_KEY) as HistoryItem[]);
      if (e.key === CLIP_KEY) setClippings(load(CLIP_KEY) as Clipping[]);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = useCallback((key: string, next: SavedItem[], setter: (v: SavedItem[]) => void) => {
    setter(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some((s) => s.id === id), [favorites]);
  const isToRead = useCallback((id: string) => toRead.some((s) => s.id === id), [toRead]);

  const toggleFavorite = useCallback((s: SavedItem) => {
    persist(FAV_KEY, isFavorite(s.id) ? favorites.filter((x) => x.id !== s.id)
      : [{ id: s.id, title: s.title, slug: s.slug }, ...favorites], setFavorites);
  }, [favorites, isFavorite, persist]);

  const toggleToRead = useCallback((s: SavedItem) => {
    persist(READ_KEY, isToRead(s.id) ? toRead.filter((x) => x.id !== s.id)
      : [{ id: s.id, title: s.title, slug: s.slug }, ...toRead], setToRead);
  }, [toRead, isToRead, persist]);

  const removeToRead = useCallback((id: string) => {
    persist(READ_KEY, toRead.filter((x) => x.id !== id), setToRead);
  }, [toRead, persist]);

  // History: most-recent first, de-duplicated, capped. Written via a functional
  // update so repeated opens (article-hopping) don't fight stale closures.
  const recordHistory = useCallback((s: SavedItem) => {
    setHistory((prev) => {
      const next = [{ id: s.id, title: s.title, slug: s.slug, ts: Date.now() },
        ...prev.filter((x) => x.id !== s.id)].slice(0, HIST_MAX);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.setItem(HIST_KEY, JSON.stringify([])); } catch {}
  }, []);

  const addClipping = useCallback((c: Omit<Clipping, 'id' | 'ts'>) => {
    setClippings((prev) => {
      const next = [{ ...c, id: 'c' + Date.now(), ts: Date.now() }, ...prev].slice(0, 100);
      try { localStorage.setItem(CLIP_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeClipping = useCallback((id: string) => {
    setClippings((prev) => {
      const next = prev.filter((c) => c.id !== id);
      try { localStorage.setItem(CLIP_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
