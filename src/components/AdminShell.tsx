'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import { Grid, FileText, Layers, Tag, Users, Home, Menu, X, Archive, Megaphone, Newspaper, BarChart, Sparkles, Check, Eye, Mail } from './icons';
import { BrandMark } from './BrandLogo';

const links = [
  { href: '/admin', label: 'Dashboard', icon: Grid, exact: true },
  { href: '/admin/analytics', label: 'Analytics', icon: Eye },
  { href: '/admin/homepage', label: 'Homepage layout', icon: Home },
  { href: '/admin/studio', label: 'Module Studio', icon: Grid },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/industry', label: 'Industry News', icon: Newspaper },
  { href: '/admin/polls', label: 'Polls', icon: BarChart },
  { href: '/admin/quizzes', label: 'Pop Quiz', icon: Check },
  { href: '/admin/comics', label: 'Comics', icon: Sparkles },
  { href: '/admin/pages', label: 'Pages', icon: Archive },
  { href: '/admin/categories', label: 'Categories', icon: Layers },
  { href: '/admin/tags', label: 'Tags', icon: Tag },
  { href: '/admin/ads', label: 'Ad management', icon: Megaphone },
  { href: '/admin/campaigns', label: 'Ad campaigns', icon: Megaphone },
  { href: '/admin/vendors', label: 'Vendors', icon: Users },
  { href: '/admin/reports', label: 'Performance reports', icon: BarChart },
  { href: '/admin/email-templates', label: 'Email templates', icon: Mail },
  { href: '/admin/users', label: 'Users (CRM)', icon: Users, adminOnly: true },
];

export default function AdminShell({
  children, user,
}: { children: React.ReactNode; user: { name: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Remember the desktop sidebar collapse across navigations/sessions.
  useEffect(() => { try { setCollapsed(localStorage.getItem('admin_nav_collapsed') === '1'); } catch {} }, []);
  const toggleCollapsed = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem('admin_nav_collapsed', n ? '1' : '0'); } catch {} return n; });
  const isActive = (l: (typeof links)[number]) => (l.exact ? pathname === l.href : pathname.startsWith(l.href));

  const nav = (
    <nav className="space-y-1">
      {links.filter((l) => !l.adminOnly || user.role === 'ADMIN').map((l) => (
        <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive(l) ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]'
          }`}>
          <l.icon width={18} height={18} /> {l.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-soft)]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <button onClick={() => setOpen((o) => !o)} className="btn-ghost h-9 w-9 !px-0 lg:hidden" aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
          {/* Desktop: collapse/expand the left nav for a full-width workspace. */}
          <button onClick={toggleCollapsed} className="btn-ghost hidden h-9 w-9 !px-0 lg:inline-flex" aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'} title={collapsed ? 'Show sidebar' : 'Hide sidebar'}>
            <Menu />
          </button>
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <BrandMark size={30} priority className="rounded-[6px]" />
            <span className="hidden sm:inline">RSNews Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/docs" className="btn-ghost btn-sm"><Home width={15} height={15} /> <span className="hidden sm:inline">View site</span></Link>
            <ThemeToggle />
            <span className="hidden text-sm text-[var(--muted)] sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className={`mx-auto flex ${collapsed ? 'max-w-none' : 'max-w-7xl'}`}>
        {/* Sidebar (desktop) — hidden when collapsed for a full-width workspace */}
        <aside className={`sticky top-14 h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg)] p-4 ${collapsed ? 'hidden' : 'hidden lg:block'}`}>
          {nav}
        </aside>

        {/* Sidebar (mobile drawer) */}
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-14 h-[calc(100vh-3.5rem)] w-64 border-r border-[var(--border)] bg-[var(--bg)] p-4">{nav}</aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
