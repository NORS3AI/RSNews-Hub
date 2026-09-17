'use client';
import { useEffect, useState } from 'react';

// Vendor "preview my ads" mode. A vendor toggles it from their dashboard; a
// cookie (their normalized brand key) travels with them so the homepage fills
// every matching slot with their live creative and the banner persists across
// pages. It's a labeled DEMO, never their bought placement — the server only
// honors the cookie when the signed-in viewer IS that vendor.
export const AD_PREVIEW_COOKIE = 'rsnews_adpreview';

function setCookie(value: string, maxAgeSec: number) {
  try { document.cookie = `${AD_PREVIEW_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`; } catch { /* ignore */ }
}
function readCookie(): string {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${AD_PREVIEW_COOKIE}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : '';
  } catch { return ''; }
}

/** Button on the vendor dashboard. `brandKey` is the server-normalized brand. */
export function AdPreviewButton({ brandKey }: { brandKey: string }) {
  return (
    <button type="button"
      onClick={() => { setCookie(brandKey, 7200); window.location.href = '/docs'; }}
      className="btn-primary btn-sm gap-1.5">
      Preview your ads on the hub →
    </button>
  );
}

/** Site-wide banner shown while preview mode is active; exit clears the cookie. */
export function AdPreviewBanner() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(!!readCookie()); }, []);
  if (!on) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[210] border-t-2 border-brand-500 bg-brand-600 px-4 py-2.5 text-white shadow-[0_-4px_24px_rgba(0,0,0,0.18)]">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-2 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm">
          <span className="font-bold">Ad preview.</span>{' '}
          Showing <span className="font-semibold">your live creatives</span> in every matching slot. This isn&apos;t your bought placement — slots showing other ads are positions you could fill.
        </p>
        <button type="button"
          onClick={() => { setCookie('', 0); window.location.href = '/docs/vendor'; }}
          className="shrink-0 rounded-lg bg-white/15 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-white/25">
          Exit preview
        </button>
      </div>
    </div>
  );
}
