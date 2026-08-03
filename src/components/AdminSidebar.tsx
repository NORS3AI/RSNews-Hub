'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@/lib/types';

const LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/pages', label: 'Pages' },
  { href: '/admin/users', label: 'Users (CRM)', adminOnly: true },
];

export default function AdminSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const links = LINKS.filter((l) => !l.adminOnly || user.role === 'admin');

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(l.href, l.exact)
              ? 'bg-brand-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white md:hidden">
        <Link href="/admin" className="font-bold">
          RSNews Admin
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-white" aria-label="Menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      {open && <div className="bg-slate-900 px-4 pb-4 md:hidden">{nav}</div>}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 p-4 text-white md:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black">
            RS
          </span>
          Admin
        </Link>
        {nav}
        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="px-2 text-xs text-slate-400">Signed in as</div>
          <div className="px-2 text-sm font-medium">{user.name}</div>
          <div className="px-2 text-xs capitalize text-brand-300">{user.role}</div>
          <div className="mt-3 flex flex-col gap-2 px-2">
            <Link href="/main" className="text-xs text-slate-300 hover:text-white">
              ← Back to site
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-xs text-slate-300 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
