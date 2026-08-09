'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addSavedSupplier } from '@/lib/actions';
import { LinkIcon, Newspaper, Star, StarFilled, Check } from '@/components/icons';

/**
 * The small "options" affordance on a premium supplier's ad. The ad itself
 * stays a direct link to the advertiser (main click); this button (rendered as
 * a sibling overlay, never inside the ad's anchor) opens a menu:
 *   • Supplier page   • Visit website   • Save to phone book
 * Only rendered for ads whose brand is a premium supplier.
 */
export default function AdOptionsMenu({
  supplierUrl, website, vendorId, saved, signedIn,
}: { supplierUrl: string | null; website: string | null; vendorId: string; saved: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(saved);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function save() {
    if (!signedIn) { router.push('/login'); return; }
    setIsSaved(true); // optimistic
    start(async () => {
      try { await addSavedSupplier(vendorId); router.refresh(); }
      catch { setIsSaved(false); }
    });
    setOpen(false);
  }

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-2)]';

  return (
    <div ref={ref} className="absolute right-2 top-2 z-20">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Supplier options" aria-haspopup="menu" aria-expanded={open}
        className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
      >
        <span className="text-[15px] font-bold leading-none">⋯</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1.5 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-[var(--shadow-card)]">
          {supplierUrl && (
            <a role="menuitem" href={supplierUrl} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
              <Newspaper width={15} height={15} /> Supplier page
            </a>
          )}
          {website && (
            <a role="menuitem" href={website} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
              <LinkIcon width={15} height={15} /> Visit website
            </a>
          )}
          <button role="menuitem" onClick={save} disabled={pending || isSaved} className={`${item} disabled:opacity-60`}>
            {isSaved ? <><Check width={15} height={15} /> In your phone book</> : <><Star width={15} height={15} /> Save to phone book</>}
          </button>
        </div>
      )}
    </div>
  );
}
