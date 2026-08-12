'use client';
import { useState } from 'react';
import { VIEW_AS_COOKIE, MEMBER_PRESETS, vendorPresetKey } from '@/lib/viewAs';

// Admin-only "View as" control, shown site-wide to staff/admin. Picking an
// audience sets a cookie and reloads; the server re-derives content gating and
// ad targeting through those entitlements (see viewAsServer.ts). The cookie is
// only honored server-side for real admins, so it's safe to set from the client.
//
// `active` is the currently-impersonated label (server-resolved), or '' when the
// admin is viewing as themselves.

function setCookie(value: string, maxAgeSec: number) {
  try { document.cookie = `${VIEW_AS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`; } catch { /* ignore */ }
}

export default function ViewAsBar({ vendorBrands, active }: { vendorBrands: string[]; active: string }) {
  const [open, setOpen] = useState(false);

  function pick(value: string) {
    if (value) setCookie(value, 7200); else setCookie('', 0);
    window.location.reload();
  }

  return (
    <div className="fixed bottom-3 left-3 z-[200] print:hidden">
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">View the site as</div>
          <button onClick={() => pick('')} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--card-2)] ${!active ? 'font-bold text-brand-600' : ''}`}>
            Myself (admin)
          </button>
          <div className="mt-1 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Member</div>
          {MEMBER_PRESETS.map((p) => (
            <button key={p.key} onClick={() => pick(p.key)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--card-2)] ${active === p.label ? 'font-bold text-brand-600' : ''}`}>
              {p.label}
            </button>
          ))}
          {vendorBrands.length > 0 && (
            <>
              <div className="mt-1 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Vendor</div>
              {vendorBrands.map((b) => (
                <button key={b} onClick={() => pick(vendorPresetKey(b))}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--card-2)] ${active === `${b} (vendor)` ? 'font-bold text-brand-600' : ''}`}>
                  {b}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-[0_4px_18px_rgba(0,0,0,0.22)] ${active ? 'bg-brand-600 text-white' : 'bg-[var(--card)] text-[var(--fg)] border border-[var(--border)]'}`}
        title="Admin: preview the site as a member or vendor"
      >
        <span aria-hidden>👁</span>
        {active ? <>Viewing as <span className="font-extrabold">{active}</span></> : 'View as…'}
      </button>
    </div>
  );
}
