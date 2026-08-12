'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import StarStrip from './StarStrip';
import SiteFooter from '@/components/SiteFooter';
import SubscribePopup, { NOTIF_CHANGED } from './SubscribePopup';
import { Home, Clock, Layers, Archive, Bell, Menu, Sun, Moon, Stamp, ChevronRight, Scissors, Star, Book } from '@/components/icons';
import { BrandMark } from '@/components/BrandLogo';
import { SITE_NAME } from '@/lib/constants';
import { classNames } from '@/lib/utils';

type U = { id: string; name: string; role: string } | null;

const NAV = [
  { href: '/docs', label: 'Home', icon: Home, exact: true },
  { href: '/docs/favorites', label: 'Favorites', icon: Star },
  { href: '/docs/history', label: 'History', icon: Clock },
  { href: '/docs/clippings', label: 'Clippings', icon: Scissors },
  { href: '/docs/categories', label: 'Categories', icon: Layers },
  { href: '/docs/archive', label: 'Archive', icon: Archive },
  { href: '/docs/suppliers', label: 'Phone Book', icon: Book },
  { href: '/docs/notifications', label: 'Notifications', icon: Bell },
];

// Three themes, cycled Light → Dark → RS (RS = Light palette + textured surfaces).
// The button shows the CURRENT theme so the label matches what's on screen.
type Theme = 'light' | 'dark' | 'rs';
const THEME_ORDER: Theme[] = ['light', 'dark', 'rs'];
const THEME_META: Record<Theme, { label: string; next: string; Icon: typeof Sun }> = {
  light: { label: 'Light mode', next: 'Dark', Icon: Sun },
  dark: { label: 'Dark mode', next: 'RS', Icon: Moon },
  rs: { label: 'RS mode', next: 'Light', Icon: Stamp },
};

function ThemeItem({ collapsed }: { collapsed: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    setTheme(el.classList.contains('dark') ? 'dark' : el.classList.contains('rs') ? 'rs' : 'light');
  }, []);
  function cycle() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    const el = document.documentElement;
    el.classList.toggle('dark', next === 'dark');
    el.classList.toggle('rs', next === 'rs');
    try { localStorage.setItem('theme', next); } catch {}
  }
  const { label, next, Icon } = THEME_META[mounted ? theme : 'light'];
  return (
    <button onClick={cycle} title={`Theme: ${label} — click for ${next}`} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--header-fg)]/70 hover:bg-white/10 hover:text-[var(--header-fg)]">
      <Icon width={21} height={21} />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

export default function AppSidebarShell({ user, children, announcement }: { user: U; children: React.ReactNode; announcement?: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const unreadReq = useRef(0);
  const isStaff = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('rsnews_sidebar') === 'collapsed'); } catch {}
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Account-wide notification badge — refetch on load, on navigation (so opening
  // the inbox clears it), and whenever a subscription change fires the event.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    // Tag each request; only the newest response is allowed to set state, so a
    // slow earlier fetch (e.g. the pre-mark-seen one on navigation) can't clobber
    // the fresh count and re-light a badge the user just cleared.
    const refresh = () => {
      const id = ++unreadReq.current;
      fetch('/api/notifications').then((r) => r.json()).then((d) => { if (alive && id === unreadReq.current) setUnread(d.unread || 0); }).catch(() => {});
    };
    refresh();
    window.addEventListener(NOTIF_CHANGED, refresh);
    return () => { alive = false; window.removeEventListener(NOTIF_CHANGED, refresh); };
  }, [user, pathname]);

  function toggleCollapse() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem('rsnews_sidebar', n ? 'collapsed' : 'expanded'); } catch {} return n; });
  }
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));

  return (
    <div className="flex min-h-screen">
      {/* Skip link — first focusable element, for keyboard/screen-reader users. */}
      <a href="#main-content" className="sr-only rounded-lg bg-brand-600 px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300]">Skip to content</a>
      {/* Sidebar */}
      <aside
        className={classNames(
          'z-50 flex shrink-0 flex-col gap-1.5 bg-[var(--header)] p-3 text-[var(--header-fg)] shadow-[2px_0_18px_rgba(0,0,0,.22)] transition-[width,transform] duration-200',
          'fixed left-0 top-0 h-[100dvh] w-[250px] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[250px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={classNames('flex items-center px-2 pb-3 pt-1', collapsed ? 'justify-center' : 'justify-between')}>
          <Link href="/docs" aria-label={`${SITE_NAME} — home`} className="flex min-w-0 items-center gap-2 font-extrabold">
            {/* Decorative here — the link's aria-label + adjacent text name it. */}
            <BrandMark size={34} priority alt="" className="shrink-0 rounded-[8px]" />
            {!collapsed && <span className="truncate whitespace-nowrap text-[16px]">{SITE_NAME}</span>}
          </Link>
          {!collapsed && (
            <button onClick={toggleCollapse} className="hidden h-8 w-8 place-items-center rounded-lg text-[var(--header-fg)]/60 hover:bg-white/10 hover:text-[var(--header-fg)] lg:grid" aria-label="Collapse menu">
              <ChevronRight width={18} height={18} className="rotate-180" />
            </button>
          )}
        </div>

        {collapsed && (
          <button onClick={toggleCollapse} className="mx-auto hidden h-8 w-8 place-items-center rounded-lg text-[var(--header-fg)]/60 hover:bg-white/10 lg:grid" aria-label="Expand menu">
            <ChevronRight width={18} height={18} />
          </button>
        )}

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={classNames(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                collapsed && 'justify-center px-0',
                active(n) ? 'bg-brand-600 text-white' : 'text-[var(--header-fg)]/70 hover:bg-white/10 hover:text-[var(--header-fg)]',
              )}
              title={collapsed ? n.label : undefined}>
              <span className="relative shrink-0">
                <n.icon width={21} height={21} />
                {n.href === '/docs/notifications' && unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid min-w-[16px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-[15px] text-white ring-2 ring-[var(--header)]">{unread > 9 ? '9+' : unread}</span>
                )}
              </span>
              {!collapsed && <span>{n.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-3">
          <ThemeItem collapsed={collapsed} />
          {isStaff && (
            <Link href="/admin" className={classNames('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--header-fg)]/70 hover:bg-white/10 hover:text-[var(--header-fg)]', collapsed && 'justify-center px-0')} title="Admin">
              <Layers width={21} height={21} />{!collapsed && <span>Admin</span>}
            </Link>
          )}
          {user ? (
            <Link href="/account" className="btn-primary" title="Account">{collapsed ? user.name.charAt(0) : user.name.split(' ')[0]}</Link>
          ) : (
            <Link href="/register" className="btn-primary">{collapsed ? '+' : 'Sign up'}</Link>
          )}
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Site-wide announcement strip (dismissible; scrolls away above the nav). */}
        {announcement}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-[color-mix(in_srgb,var(--bg)_70%,#000_6%)] px-4 py-3 backdrop-blur lg:px-7 lg:py-4">
          <button onClick={() => setMobileOpen(true)} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] bg-[var(--card)] text-[var(--fg)] shadow-[var(--shadow-card)] lg:hidden" aria-label="Open menu">
            <Menu width={22} height={22} />
          </button>
          <div className="w-full max-w-xl"><SearchBar /></div>
        </header>

        <main id="main-content" className="flex-1">
          <div className="px-4 lg:px-7"><StarStrip /></div>
          {children}
        </main>
        <SiteFooter />
      </div>

      {/* Shared Subscribe popup — opened from anywhere via a window event. */}
      <SubscribePopup />
    </div>
  );
}
