'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type SavedItem = { id: string; title: string; slug: string };
export type HistoryItem = SavedItem & { ts: number };

type Ctx = {
  favorites: SavedItem[];
  toRead: SavedItem[];
  history: HistoryItem[];
  isFavorite: (id: string) => boolean;
  isToRead: (id: string) => boolean;
  toggleFavorite: (s: SavedItem) => void;
  toggleToRead: (s: SavedItem) => void;
  removeToRead: (id: string) => void;
  recordHistory: (s: SavedItem) => void;
  clearHistory: () => void;
  ready: boolean;
};

const Ctx = createContext<Ctx | null>(null);
const FAV_KEY = 'rsnews_favorites_v1';
const READ_KEY = 'rsnews_toread_v1';
const HIST_KEY = 'rsnews_history_v1';
const HIST_MAX = 50;

function load(key: string): SavedItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [toRead, setToRead] = useState<SavedItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(load(FAV_KEY));
    setToRead(load(READ_KEY));
    setHistory(load(HIST_KEY) as HistoryItem[]);
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY) setFavorites(load(FAV_KEY));
      if (e.key === READ_KEY) setToRead(load(READ_KEY));
      if (e.key === HIST_KEY) setHistory(load(HIST_KEY) as HistoryItem[]);
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

  return (
    <Ctx.Provider value={{ favorites, toRead, history, isFavorite, isToRead, toggleFavorite, toggleToRead, removeToRead, recordHistory, clearHistory, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSaved must be used within StarProvider');
  return ctx;
}
