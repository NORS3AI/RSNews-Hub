'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Star = { id: string; title: string; slug: string };

type StarCtx = {
  stars: Star[];
  isStarred: (id: string) => boolean;
  toggle: (s: Star) => void;
  remove: (id: string) => void;
  ready: boolean;
};

const Ctx = createContext<StarCtx | null>(null);
const KEY = 'rsnews_stars_v1';

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [stars, setStars] = useState<Star[]>([]);
  const [ready, setReady] = useState(false);

  // Load once, and keep in sync across tabs.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setStars(JSON.parse(raw));
    } catch {}
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) { try { setStars(e.newValue ? JSON.parse(e.newValue) : []); } catch {} }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = useCallback((next: Star[]) => {
    setStars(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }, []);

  const isStarred = useCallback((id: string) => stars.some((s) => s.id === id), [stars]);

  const toggle = useCallback((s: Star) => {
    persist(isStarred(s.id) ? stars.filter((x) => x.id !== s.id) : [{ id: s.id, title: s.title, slug: s.slug }, ...stars]);
  }, [stars, isStarred, persist]);

  const remove = useCallback((id: string) => persist(stars.filter((x) => x.id !== id)), [stars, persist]);

  return <Ctx.Provider value={{ stars, isStarred, toggle, remove, ready }}>{children}</Ctx.Provider>;
}

export function useStars() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStars must be used within StarProvider');
  return ctx;
}
