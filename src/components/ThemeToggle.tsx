'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon, Stamp } from './icons';

// Three themes, cycled in order. RS Mode = Light palette + textured surfaces.
type Theme = 'light' | 'dark' | 'rs';
const ORDER: Theme[] = ['light', 'dark', 'rs'];
const LABEL: Record<Theme, string> = { light: 'Light', dark: 'Dark', rs: 'RS' };

function apply(t: Theme) {
  const el = document.documentElement;
  el.classList.toggle('dark', t === 'dark');
  el.classList.toggle('rs', t === 'rs');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    setTheme(el.classList.contains('dark') ? 'dark' : el.classList.contains('rs') ? 'rs' : 'light');
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next);
    try { localStorage.setItem('theme', next); } catch {}
  }

  if (!mounted) return <div className="h-9 w-9" aria-hidden />;
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  // Show the icon of the CURRENT theme so it matches what's on screen.
  const icon = theme === 'dark' ? <Moon /> : theme === 'rs' ? <Stamp /> : <Sun />;
  return (
    <button onClick={cycle} className="btn-ghost h-9 w-9 !px-0"
      aria-label={`Theme: ${LABEL[theme]}. Click to switch to ${LABEL[next]} mode.`}
      title={`Theme: ${LABEL[theme]} — click for ${LABEL[next]}`}>
      {icon}
    </button>
  );
}
