'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from './icons';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  }

  if (!mounted) return <div className="h-9 w-9" aria-hidden />;
  return (
    <button onClick={toggle} className="btn-ghost h-9 w-9 !px-0" aria-label="Toggle theme" title="Toggle theme">
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
