import Link from 'next/link';
import { SITE_NAME, APP_VERSION } from '@/lib/constants';

export default function SiteFooter() {
  return (
    <footer className="mt-16">
      <div className="container-page py-8">
        {/* On a card so it themes correctly in light / dark / RS instead of bare
            text on the page surround. */}
        <div className="module">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="font-bold">{SITE_NAME}</div>
            <p className="mt-2 text-sm text-[var(--muted)]">News, articles and documentation — read, discover and subscribe from any device.</p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <div className="mb-2 font-medium">Read</div>
              <ul className="space-y-1.5 text-[var(--muted)]">
                <li><Link href="/docs" className="hover:text-[var(--fg)]">Latest</Link></li>
                <li><Link href="/docs/categories" className="hover:text-[var(--fg)]">Categories</Link></li>
                <li><Link href="/docs/archive" className="hover:text-[var(--fg)]">Archive</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-medium">Account</div>
              <ul className="space-y-1.5 text-[var(--muted)]">
                <li><Link href="/docs/subscriptions" className="hover:text-[var(--fg)]">Subscriptions</Link></li>
                <li><Link href="/login" className="hover:text-[var(--fg)]">Sign in</Link></li>
                <li><Link href="/register" className="hover:text-[var(--fg)]">Sign up</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-medium">More</div>
              <ul className="space-y-1.5 text-[var(--muted)]">
                <li><Link href="/docs/page/about" className="hover:text-[var(--fg)]">About</Link></li>
                <li><Link href="/docs/page/privacy" className="hover:text-[var(--fg)]">Privacy Policy</Link></li>
                <li><Link href="/docs/page/terms" className="hover:text-[var(--fg)]">Terms of Service</Link></li>
                <li><Link href="/docs/page/copyright" className="hover:text-[var(--fg)]">Copyright &amp; DMCA</Link></li>
                <li><Link href="/admin" className="hover:text-[var(--fg)]">Admin</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
          <span>© {new Date().getFullYear()} {SITE_NAME}. Embeddable news hub.</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--card-2)] px-2.5 py-1 font-semibold tracking-wide">{APP_VERSION}</span>
        </div>
        </div>
      </div>
    </footer>
  );
}
