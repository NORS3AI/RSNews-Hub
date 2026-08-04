'use client';
import { useState } from 'react';
import { Share, Copy, X } from '@/components/icons';

/**
 * Share the article's canonical URL. Works even though articles open in a
 * modal — every article has a real /docs/article/<slug> page behind it.
 */
export default function ShareButton({ slug, title }: { slug: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/docs/article/${slug}` : `/docs/article/${slug}`;
  const enc = encodeURIComponent;
  const socials = [
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: 'Email', href: `mailto:?subject=${enc(title)}&body=${enc(url)}` },
  ];

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }
  async function native() {
    try { await (navigator as any).share({ title, url }); } catch {}
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost h-9 w-9 !px-0" aria-label="Share" title="Share">
        <Share width={17} height={17} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-modal">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <h3 className="text-lg font-extrabold">Share this article</h3>
              <button onClick={() => setOpen(false)} className="btn-ghost h-9 w-9 !px-0" aria-label="Close"><X /></button>
            </div>
            <div className="p-5">
              <div className="mb-4 flex gap-2">
                <input readOnly value={url} className="input flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
                <button onClick={copy} className="btn-primary btn-sm shrink-0"><Copy width={15} height={15} />{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="grid h-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card-2)] font-bold hover:border-brand-400 hover:text-brand-600">
                    {s.label}
                  </a>
                ))}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button onClick={native} className="col-span-2 grid h-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card-2)] font-bold hover:border-brand-400 hover:text-brand-600">
                    More sharing options…
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
