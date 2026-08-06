'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon, Stamp } from './icons';
import { track } from '@/lib/analytics/track';
import { setUserTheme } from '@/lib/actions';

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
    const current: Theme = el.classList.contains('dark') ? 'dark' : el.classList.contains('rs') ? 'rs' : 'light';
    setTheme(current);
    // Emit the effective theme once per session so usage is measured even for
    // visitors who never touch the toggle. Guarded so a re-render/route change
    // doesn't double-count within the same browsing session.
    try {
      if (!sessionStorage.getItem('rsnews_theme_seen')) {
        sessionStorage.setItem('rsnews_theme_seen', '1');
        track({ type: 'theme', props: { theme: current, reason: 'active' } });
      }
    } catch { /* private mode — skip */ }
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next);
    try { localStorage.setItem('theme', next); } catch {}
    // Remember on the account (no-op when anonymous) so it follows the member
    // across devices, and record the deliberate switch for analytics.
    setUserTheme(next).catch(() => {});
    track({ type: 'theme', props: { theme: next, reason: 'switch' } });
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
