import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/constants';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
  openGraph: { title: SITE_NAME, description: SITE_DESCRIPTION, type: 'website' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#232a36' },
    { media: '(prefers-color-scheme: dark)', color: '#141821' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Account-remembered theme: if the member has a saved preference, hand it to
  // the bootstrap so their theme follows them across devices with no flash.
  // Anonymous visitors (or members who never set one) fall back to localStorage.
  let serverTheme = '';
  try {
    const su = await getSessionUser();
    if (su) {
      const u = await prisma.user.findUnique({ where: { id: su.id }, select: { theme: true } });
      const t = u?.theme;
      if (t === 'light' || t === 'dark' || t === 'rs') serverTheme = t;
    }
  } catch { /* auth/db hiccup must never block the shell from rendering */ }

  // Admin-configurable RS-Mode page background (Phase 7). Validated hex only, so
  // it is safe to inline. Applies exclusively in RS Mode.
  let rsBg = '';
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'rs_bg_color' } });
    if (s && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.value)) rsBg = s.value;
  } catch { /* ignore */ }

  // CSP nonce (set per-request in middleware) — stamps the inline bootstrap so it
  // runs under the strict script-src. Empty in dev/tests where no CSP is applied.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var st=${JSON.stringify(serverTheme)};var t=st||localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var el=document.documentElement;if(t==='dark'||(!t&&m)){el.classList.add('dark');}else if(t==='rs'){el.classList.add('rs');}if(st){try{localStorage.setItem('theme',st);}catch(e){}}}catch(e){}})();`,
          }}
        />
        {rsBg && (
          <style nonce={nonce} dangerouslySetInnerHTML={{ __html: `.rs body::before{background-image:none!important;background-color:${rsBg}!important;}` }} />
        )}
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
