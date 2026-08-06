'use client';
import { useEffect, useState } from 'react';
import { useArticleModal } from './ArticleModalProvider';
import { track } from '@/lib/analytics/track';
import { ArrowLeft, ArrowRight } from '@/components/icons';

export type FeatureItem = {
  slug: string; title: string; excerpt: string | null; coverImage: string | null;
  category: { name: string; color: string } | null;
};

/**
 * A big split showcase: one story at a time — title on one half, image on the
 * other — paged left/right. Deliberately roomy to give the page some breathing
 * space. Clicking the story opens the normal reader modal.
 */
export default function FeatureCarousel({ items }: { items: FeatureItem[] }) {
  const { openArticle } = useArticleModal();
  const [i, setI] = useState(0);
  const n = items.length;
  const a = items[i];

  // Per-slide impression — later slides only count if the reader actually pages to them.
  useEffect(() => {
    if (!a) return;
    track({ type: 'impression', subjectType: 'article', subjectId: a.slug, placement: 'feature-showcase', pageType: 'home',
      props: { module: 'feature-showcase', moduleType: 'showcase', pos: i, slide: i, hasImage: !!a.coverImage, category: a.category?.name, viewable: true } });
  }, [i, a]);

  if (!items.length) return null;
  const go = (d: number) => {
    track({ type: 'nav', subjectType: 'module', subjectId: 'feature-showcase', placement: 'feature-showcase', pageType: 'home', props: { action: 'arrow', dir: d } });
    setI((p) => (p + d + n) % n);
  };
  const open = (slug: string) => {
    track({ type: 'click', subjectType: 'article', subjectId: slug, placement: 'feature-showcase', pageType: 'home', props: { module: 'feature-showcase', moduleType: 'showcase', pos: i } });
    openArticle(slug);
  };
  const accent = a.category?.color || '#E97D34';

  return (
    <section className="feature-showcase overflow-hidden rounded-2xl border border-[var(--border)] shadow-card">
      <div className="grid md:grid-cols-2">
        {/* Text half */}
        <div className="relative flex min-h-[300px] flex-col justify-center bg-ink-950 p-8 text-white sm:p-10 md:min-h-[420px] lg:p-14">
          {a.category && (
            <div className="mb-5 inline-flex w-fit flex-col">
              <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{a.category.name}</span>
              <span className="mt-1 h-0.5 w-9" style={{ background: accent }} />
            </div>
          )}
          <h2 className="max-w-xl text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-[42px]">
            <button onClick={() => open(a.slug)} className="text-left hover:opacity-90">{a.title}</button>
          </h2>
          <button onClick={() => open(a.slug)} className="mt-7 w-fit text-sm font-bold text-white underline decoration-2 underline-offset-4 hover:opacity-80">
            Read the full story
          </button>

          {n > 1 && (
            <div className="mt-auto flex items-center gap-3 pt-9">
              <button onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white/10" aria-label="Previous story"><ArrowLeft width={18} height={18} /></button>
              <button onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white/10" aria-label="Next story"><ArrowRight width={18} height={18} /></button>
              <span className="ml-2 text-xs font-semibold text-white/50">{i + 1} / {n}</span>
            </div>
          )}
        </div>

        {/* Image half */}
        <button onClick={() => open(a.slug)} className="group relative min-h-[220px] overflow-hidden md:min-h-[420px]" aria-label={`Open ${a.title}`}>
          {a.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.coverImage} alt={a.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] text-6xl font-black text-black/10 dark:from-[#33303a] dark:to-[#201d28] dark:text-white/10">RS</span>
          )}
        </button>
      </div>
    </section>
  );
}
