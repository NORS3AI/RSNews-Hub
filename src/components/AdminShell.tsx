'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import { Grid, FileText, Layers, Tag, Users, Home, Menu, X, Archive } from './icons';

const links = [
  { href: '/admin', label: 'Dashboard', icon: Grid, exact: true },
  { href: '/admin/homepage', label: 'Homepage layout', icon: Home },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/pages', label: 'Pages', icon: Archive },
  { href: '/admin/categories', label: 'Categories', icon: Layers },
  { href: '/admin/tags', label: 'Tags', icon: Tag },
  { href: '/admin/users', label: 'Users (CRM)', icon: Users, adminOnly: true },
];

export default function AdminShell({
  children, user,
}: { children: React.ReactNode; user: { name: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
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
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-xs font-black text-white">RS</span>
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

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg)] p-4 lg:block">
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
