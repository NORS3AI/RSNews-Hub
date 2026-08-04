'use client';
import { useEffect, useState } from 'react';
import { X } from '@/components/icons';

/**
 * A comic image that opens a large lightbox overlay when clicked, so readers
 * can get a closer look. Esc or a click outside closes it.
 */
export default function ComicImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`${className ?? ''} cursor-zoom-in`} onClick={() => setOpen(true)} />

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-8 animate-fade-in" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" />
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25" aria-label="Close"><X /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="relative z-10 max-h-[92dvh] w-auto max-w-full cursor-zoom-out rounded-xl shadow-modal" />
        </div>
      )}
    </>
  );
}
