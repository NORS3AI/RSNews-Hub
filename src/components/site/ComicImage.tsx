'use client';
import { useEffect, useState } from 'react';
import { useSaved } from './StarProvider';
import { downloadImage } from '@/lib/quoteImage';
import { track } from '@/lib/analytics/track';
import { X, Download, Scissors, Check } from '@/components/icons';

/**
 * A comic image that opens a large lightbox overlay when clicked. The overlay
 * offers Download and Save-to-clippings. Esc / click-outside / X closes it.
 */
export default function ComicImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const { addClipping } = useSaved();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const fileName = `backroom-humor-${(alt || 'comic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.jpg`;

  function save() {
    if (saved) return;
    addClipping({ kind: 'comic', title: alt, image: src });
    track({ type: 'clip', subjectType: 'clip', pageType: 'home', props: { action: 'save', kind: 'comic', source: 'comic' } });
    setSaved(true);
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`${className ?? ''} cursor-zoom-in`} onClick={() => setOpen(true)} />

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-8 animate-fade-in" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" />
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25" aria-label="Close"><X /></button>

          <div className="relative z-10 flex max-h-[94dvh] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[82dvh] w-auto max-w-full rounded-xl shadow-modal" />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => downloadImage(src, fileName)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-bold text-white hover:bg-white/25">
                <Download width={16} height={16} /> Download image
              </button>
              <button onClick={save} disabled={saved} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-70">
                {saved ? <><Check width={16} height={16} /> Saved to clippings</> : <><Scissors width={16} height={16} /> Save to clippings</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
