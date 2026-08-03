import type { Metadata } from 'next';
import './globals.css';
import { ensureSeeded } from '@/lib/seed';

export const metadata: Metadata = {
  title: {
    default: 'RSNews Hub',
    template: '%s · RSNews Hub',
  },
  description:
    'RSNews Hub — read the latest articles, guides and announcements with smart recommendations, search and an archive.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Idempotent bootstrap (admin account + demo content on first run).
  ensureSeeded();
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
