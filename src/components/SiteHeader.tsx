'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@/lib/types';

const NAV = [
  { href: '/main', label: 'Home' },
  { href: '/categories', label: 'Categories' },
  { href: '/archive', label: 'Archive' },
  { href: '/search', label: 'Search' },
  { href: '/docs', label: 'Docs' },
];

export default function SiteHeader({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isStaff = user && (user.role === 'admin' || user.role === 'editor');

  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-brand-50 text-brand-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-rs flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/main" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              RS
            </span>
            <span>News Hub</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {isStaff && (
            <Link href="/admin" className="btn-secondary">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <Link href="/dashboard" className="btn-ghost">
                {user.name.split(' ')[0]}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="btn-secondary">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="container-rs flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(item.href)}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-slate-200" />
            {isStaff && (
              <Link href="/admin" className="btn-secondary" onClick={() => setOpen(false)}>
                Admin dashboard
              </Link>
            )}
            {user ? (
              <>
                <Link href="/dashboard" className="btn-ghost" onClick={() => setOpen(false)}>
                  My dashboard
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="btn-secondary w-full">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary flex-1" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
