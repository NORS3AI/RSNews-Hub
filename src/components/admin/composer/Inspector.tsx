'use client';
import { useEffect, useRef, useState } from 'react';
import { useComposer } from './context';
import ArticleDetails from './ArticleDetails';
import ElementInspector from './ElementInspector';

type Cat = { id: string; name: string };
type BylineOpt = { id: string; name: string; title: string | null; photo: string | null; bio: string | null };

// Right rail: Article details vs the selected element's options. Both stay
// mounted (just hidden) so the article's form fields always submit — we only
// flip which one is visible, auto-switching to Element when you select one.
export default function Inspector({ article, categories, vendors = [], bylines = [] }: { article?: any; categories: Cat[]; vendors?: { id: string; name: string }[]; bylines?: BylineOpt[] }) {
  const { selected } = useComposer();
  const [tab, setTab] = useState<'article' | 'element'>('article');
  const had = useRef(false);
  useEffect(() => {
    const has = !!selected;
    if (has && !had.current) setTab('element');
    if (!has && had.current) setTab('article');
    had.current = has;
  }, [selected]);

  const btn = (active: boolean) => `flex-1 rounded-lg py-1.5 text-sm font-bold transition ${active ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`;

  return (
    <div>
      {/* Sticky within the panel's own scroll area, so the tabs stay reachable
          while a long options list scrolls beneath them. */}
      <div className="z-10 -mx-4 -mt-4 mb-4 bg-[var(--composer-panel)] px-4 pb-2 pt-4 lg:sticky lg:top-0">
        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
          <button type="button" onClick={() => setTab('article')} className={btn(tab === 'article')}>Article details</button>
          <button type="button" onClick={() => setTab('element')} className={btn(tab === 'element')}>Element{selected ? ' •' : ''}</button>
        </div>
      </div>
      <div className={tab === 'article' ? '' : 'hidden'}><ArticleDetails article={article} categories={categories} vendors={vendors} bylines={bylines} /></div>
      <div className={tab === 'element' ? '' : 'hidden'}><ElementInspector /></div>
    </div>
  );
}
