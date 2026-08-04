'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type SavedItem = { id: string; title: string; slug: string };

type Ctx = {
  favorites: SavedItem[];
  toRead: SavedItem[];
  isFavorite: (id: string) => boolean;
  isToRead: (id: string) => boolean;
  toggleFavorite: (s: SavedItem) => void;
  toggleToRead: (s: SavedItem) => void;
  removeToRead: (id: string) => void;
  ready: boolean;
};

const Ctx = createContext<Ctx | null>(null);
const FAV_KEY = 'rsnews_favorites_v1';
const READ_KEY = 'rsnews_toread_v1';

function load(key: string): SavedItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [toRead, setToRead] = useState<SavedItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(load(FAV_KEY));
    setToRead(load(READ_KEY));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY) setFavorites(load(FAV_KEY));
      if (e.key === READ_KEY) setToRead(load(READ_KEY));
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

  return (
    <Ctx.Provider value={{ favorites, toRead, isFavorite, isToRead, toggleFavorite, toggleToRead, removeToRead, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSaved must be used within StarProvider');
  return ctx;
}
