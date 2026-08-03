import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-rs flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              RS
            </span>
            News Hub
          </div>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Articles, guides and announcements with smart recommendations, search and an archive.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <Link href="/main" className="text-slate-600 hover:text-slate-900">
            Home
          </Link>
          <Link href="/archive" className="text-slate-600 hover:text-slate-900">
            Archive
          </Link>
          <Link href="/categories" className="text-slate-600 hover:text-slate-900">
            Categories
          </Link>
          <Link href="/search" className="text-slate-600 hover:text-slate-900">
            Search
          </Link>
          <Link href="/docs" className="text-slate-600 hover:text-slate-900">
            Docs
          </Link>
          <Link href="/p/about" className="text-slate-600 hover:text-slate-900">
            About
          </Link>
        </nav>
      </div>
      <div className="border-t border-slate-100 py-4">
        <div className="container-rs text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RSNews Hub. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
