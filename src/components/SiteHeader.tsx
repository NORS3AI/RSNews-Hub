'use client';
import { useState } from 'react';
import Link from 'next/link';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';
import { Menu, X, Archive, Sparkles, Bell, Layers } from './icons';
import { SITE_NAME } from '@/lib/constants';

type U = { id: string; name: string; email: string; role: string } | null;

const nav = [
  { href: '/docs', label: 'Home' },
  { href: '/docs/categories', label: 'Categories', icon: Layers },
  { href: '/docs/archive', label: 'Archive', icon: Archive },
  { href: '/docs/subscriptions', label: 'Subscriptions', icon: Bell },
];

export default function SiteHeader({ user }: { user: U }) {
  const [open, setOpen] = useState(false);
  const isStaff = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="container-page">
        <div className="flex h-16 items-center gap-3">
          <Link href="/docs" className="flex shrink-0 items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Sparkles width={18} height={18} /></span>
            <span className="hidden sm:inline">{SITE_NAME}</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="btn-ghost !px-3 !py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden max-w-xs flex-1 lg:block"><SearchBar /></div>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {isStaff && <Link href="/admin" className="btn-outline btn-sm">Admin</Link>}
            {user ? (
              <Link href="/account" className="btn-primary btn-sm">{user.name.split(' ')[0]}</Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
                <Link href="/register" className="btn-primary btn-sm">Sign up</Link>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button onClick={() => setOpen((o) => !o)} className="btn-ghost h-9 w-9 !px-0" aria-label="Menu" aria-expanded={open}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        <div className="pb-3 lg:hidden">
          <SearchBar />
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] md:hidden">
          <div className="container-page space-y-1 py-3">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--bg-soft)]">
                {n.icon && <n.icon width={16} height={16} />}{n.label}
              </Link>
            ))}
            <div className="my-2 border-t border-[var(--border)]" />
            {isStaff && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--bg-soft)]">Admin dashboard</Link>}
            {user ? (
              <Link href="/account" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--bg-soft)]">My account</Link>
            ) : (
              <div className="flex gap-2 px-3 pt-1">
                <Link href="/login" onClick={() => setOpen(false)} className="btn-outline btn-sm flex-1">Sign in</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn-primary btn-sm flex-1">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
