'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import { Grid, FileText, Layers, Tag, Users, Home, Menu, X, Archive, Megaphone, Newspaper, BarChart, Sparkles, Check, Eye, Mail, Calendar, Clock, ChevronDown, ChevronRight, ExternalLink } from './icons';
import { BrandMark } from './BrandLogo';

type NavLink = { href: string; label: string; icon: typeof Grid; exact?: boolean; adminOnly?: boolean };
type NavGroup = { title: string | null; links: NavLink[] };

// Grouped into collapsible sections to keep a long nav tidy.
const groups: NavGroup[] = [
  { title: null, links: [
    { href: '/admin', label: 'Dashboard', icon: Grid, exact: true },
    { href: '/admin/analytics', label: 'Analytics', icon: Eye },
    { href: '/admin/activity', label: 'Recent activity', icon: Clock },
  ] },
  { title: 'Homepage', links: [
    { href: '/admin/homepage', label: 'Homepage layout', icon: Home },
    { href: '/admin/studio', label: 'Module Studio', icon: Grid },
    { href: '/admin/schedule', label: 'Schedule', icon: Calendar },
  ] },
  { title: 'Create content', links: [
    { href: '/admin/articles', label: 'Articles', icon: FileText },
    { href: '/admin/industry', label: 'Industry News', icon: Newspaper },
    { href: '/admin/polls', label: 'Polls', icon: BarChart },
    { href: '/admin/quizzes', label: 'Pop Quiz', icon: Check },
    { href: '/admin/comics', label: 'Comics', icon: Sparkles },
    { href: '/admin/pages', label: 'Pages', icon: Archive },
  ] },
  { title: 'Organize', links: [
    { href: '/admin/categories', label: 'Categories', icon: Layers },
    { href: '/admin/tags', label: 'Tags', icon: Tag },
  ] },
  { title: 'Advertising', links: [
    { href: '/admin/ads', label: 'Ad management', icon: Megaphone },
    { href: '/admin/campaigns', label: 'Ad campaigns', icon: Megaphone },
    { href: '/admin/vendors', label: 'Vendors', icon: Users },
    { href: '/admin/reports', label: 'Performance reports', icon: BarChart },
  ] },
  { title: 'System', links: [
    { href: '/admin/email-templates', label: 'Email templates', icon: Mail },
    { href: '/admin/subscribers', label: 'Subscribers', icon: Mail },
    { href: '/admin/integrations', label: 'Integrations', icon: ExternalLink, adminOnly: true },
    { href: '/admin/users', label: 'Users (CRM)', icon: Users, adminOnly: true },
  ] },
];

export default function AdminShell({
  children, user,
}: { children: React.ReactNode; user: { name: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  // Remember the desktop sidebar collapse + section state across sessions.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('admin_nav_collapsed') === '1');
      const g = localStorage.getItem('admin_nav_groups');
      if (g) setClosedGroups(JSON.parse(g));
    } catch {}
  }, []);
  const toggleCollapsed = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem('admin_nav_collapsed', n ? '1' : '0'); } catch {} return n; });
  const toggleGroup = (title: string) => setClosedGroups((g) => { const n = { ...g, [title]: !g[title] }; try { localStorage.setItem('admin_nav_groups', JSON.stringify(n)); } catch {} return n; });
  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname.startsWith(l.href));

  // Fully theme-aware chrome: light in Light/RS, dark in Dark — consistent with
  // the content area, so the whole admin flips with the theme toggle.
  const linkClass = (l: NavLink) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive(l) ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
    }`;

  const nav = (
    <nav className="space-y-3">
      {groups.map((group, gi) => {
        const items = group.links.filter((l) => !l.adminOnly || user.role === 'ADMIN');
        if (!items.length) return null;
        const closed = group.title ? closedGroups[group.title] : false;
        return (
          <div key={group.title ?? `g${gi}`}>
            {group.title && (
              <button onClick={() => toggleGroup(group.title!)}
                className="mb-1 flex w-full items-center gap-1 px-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                {closed ? <ChevronRight width={12} height={12} /> : <ChevronDown width={12} height={12} />} {group.title}
              </button>
            )}
            {!closed && (
              <div className="space-y-0.5">
                {items.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={linkClass(l)}>
                    <l.icon width={18} height={18} /> {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const chrome = 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800';
  const ghost = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';
  return (
    // Fully theme-aware admin: light surfaces in Light/RS, dark in Dark. All text
    // uses slate scales that flip with the theme, so it's readable in every mode.
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Top bar */}
      <header className={`sticky top-0 z-40 border-b ${chrome}`}>
        <div className="flex h-14 items-center gap-3 px-4">
          <button onClick={() => setOpen((o) => !o)} className={`btn-ghost h-9 w-9 !px-0 ${ghost} lg:hidden`} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
          {/* Desktop: collapse/expand the left nav for a full-width workspace. */}
          <button onClick={toggleCollapsed} className={`btn-ghost hidden h-9 w-9 !px-0 ${ghost} lg:inline-flex`} aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'} title={collapsed ? 'Show sidebar' : 'Hide sidebar'}>
            <Menu />
          </button>
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <BrandMark size={30} priority className="rounded-[6px]" />
            <span className="hidden sm:inline">RSNews Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/docs" className={`btn-ghost btn-sm ${ghost}`}><Home width={15} height={15} /> <span className="hidden sm:inline">View site</span></Link>
            <ThemeToggle />
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className={`mx-auto flex ${collapsed ? 'max-w-none' : 'max-w-7xl'}`}>
        {/* Sidebar (desktop) — hidden when collapsed for a full-width workspace */}
        <aside className={`sticky top-14 h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r p-4 ${chrome} ${collapsed ? 'hidden' : 'hidden lg:block'}`}>
          {nav}
        </aside>

        {/* Sidebar (mobile drawer) */}
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className={`absolute left-0 top-14 h-[calc(100vh-3.5rem)] w-64 overflow-y-auto border-r p-4 ${chrome}`}>{nav}</aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
