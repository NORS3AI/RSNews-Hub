'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import StarStrip from './StarStrip';
import SiteFooter from '@/components/SiteFooter';
import { Home, Clock, Layers, Archive, Bell, Menu, Sun, Moon, ChevronRight, Scissors } from '@/components/icons';
import { SITE_NAME } from '@/lib/constants';
import { classNames } from '@/lib/utils';

type U = { id: string; name: string; role: string } | null;

const NAV = [
  { href: '/docs', label: 'Home', icon: Home, exact: true },
  { href: '/docs/history', label: 'History', icon: Clock },
  { href: '/docs/clippings', label: 'Clippings', icon: Scissors },
  { href: '/docs/categories', label: 'Categories', icon: Layers },
  { href: '/docs/archive', label: 'Archive', icon: Archive },
  { href: '/docs/subscriptions', label: 'Subscriptions', icon: Bell },
];

function ThemeItem({ collapsed }: { collapsed: boolean }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); setDark(document.documentElement.classList.contains('dark')); }, []);
  function toggle() {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  }
  return (
    <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--header-fg)]/70 hover:bg-white/10 hover:text-[var(--header-fg)]">
      {mounted && dark ? <Sun width={21} height={21} /> : <Moon width={21} height={21} />}
      {!collapsed && <span>{mounted && dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}

export default function AppSidebarShell({ user, children }: { user: U; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStaff = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('rsnews_sidebar') === 'collapsed'); } catch {}
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCollapse() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem('rsnews_sidebar', n ? 'collapsed' : 'expanded'); } catch {} return n; });
  }
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));

  return (
    <div className="flex min-h-screen">
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
          <Link href="/docs" className="flex min-w-0 items-center gap-2.5 font-extrabold">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-brand-600 text-sm font-black text-white">RS</span>
            {!collapsed && <span className="truncate text-[17px]">{SITE_NAME}</span>}
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
              <n.icon width={21} height={21} className="shrink-0" />
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
        <div className="sticky top-0 z-30 flex items-center gap-3 bg-[color-mix(in_srgb,var(--bg)_70%,#000_6%)] px-4 py-3 backdrop-blur lg:px-7 lg:py-4">
          <button onClick={() => setMobileOpen(true)} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] bg-[var(--card)] text-[var(--fg)] shadow-[var(--shadow-card)] lg:hidden" aria-label="Open menu">
            <Menu width={22} height={22} />
          </button>
          <div className="w-full max-w-xl"><SearchBar /></div>
        </div>

        <div className="px-4 lg:px-7"><StarStrip /></div>

        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
