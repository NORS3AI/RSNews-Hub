'use client';
import { useState } from 'react';
import Link from 'next/link';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';
import { Menu, X, Archive, Bell, Layers } from './icons';
import { SITE_NAME } from '@/lib/constants';

type U = { id: string; name: string; email: string; role: string } | null;

const nav = [
  { href: '/docs', label: 'Home' },
  { href: '/docs/categories', label: 'Categories', icon: Layers },
  { href: '/docs/archive', label: 'Archive', icon: Archive },
  { href: '/docs/subscriptions', label: 'Subscriptions', icon: Bell },
];

function Logo() {
  return (
    <Link href="/docs" className="flex shrink-0 items-center gap-2 font-bold text-[var(--header-fg)]">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-sm font-black text-white">RS</span>
      <span className="hidden text-[15px] tracking-tight sm:inline">{SITE_NAME}</span>
    </Link>
  );
}

export default function SiteHeader({ user }: { user: U }) {
  const [open, setOpen] = useState(false);
  const isStaff = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

  return (
    <header className="bg-[var(--header)] text-[var(--header-fg)] shadow-sm">
      <div className="container-page">
        <div className="flex h-16 items-center gap-3">
          <Logo />

          <nav className="ml-3 hidden items-center gap-0.5 md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--header-fg)]/75 transition-colors hover:bg-white/10 hover:text-[var(--header-fg)]">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden max-w-xs flex-1 lg:block"><SearchBar /></div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="text-[var(--header-fg)]"><ThemeToggle /></div>
            {isStaff && <Link href="/admin" className="btn-sm rounded-lg border border-white/25 px-3 py-1.5 text-[var(--header-fg)] hover:bg-white/10">Admin</Link>}
            {user ? (
              <Link href="/account" className="btn-primary btn-sm">{user.name.split(' ')[0]}</Link>
            ) : (
              <>
                <Link href="/login" className="btn-sm rounded-lg px-3 py-1.5 text-[var(--header-fg)]/85 hover:bg-white/10">Sign in</Link>
                <Link href="/register" className="btn-primary btn-sm">Sign up</Link>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 md:hidden">
            <div className="text-[var(--header-fg)]"><ThemeToggle /></div>
            <button onClick={() => setOpen((o) => !o)} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--header-fg)] hover:bg-white/10" aria-label="Menu" aria-expanded={open}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        <div className="pb-3 lg:hidden">
          <SearchBar />
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[var(--header)] md:hidden">
          <div className="container-page space-y-1 py-3">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--header-fg)]/85 hover:bg-white/10">
                {n.icon && <n.icon width={16} height={16} />}{n.label}
              </Link>
            ))}
            <div className="my-2 border-t border-white/10" />
            {isStaff && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-[var(--header-fg)]/85 hover:bg-white/10">Admin dashboard</Link>}
            {user ? (
              <Link href="/account" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-[var(--header-fg)]/85 hover:bg-white/10">My account</Link>
            ) : (
              <div className="flex gap-2 px-3 pt-1">
                <Link href="/login" onClick={() => setOpen(false)} className="btn-sm flex-1 rounded-lg border border-white/25 py-2 text-center text-[var(--header-fg)] hover:bg-white/10">Sign in</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn-primary btn-sm flex-1">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
