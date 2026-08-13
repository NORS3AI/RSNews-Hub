'use client';
import { useEffect, useRef, useState } from 'react';
import { useComposer } from './context';
import ArticleDetails from './ArticleDetails';
import ElementInspector from './ElementInspector';

type Cat = { id: string; name: string };

// Right rail: Article details vs the selected element's options. Both stay
// mounted (just hidden) so the article's form fields always submit — we only
// flip which one is visible, auto-switching to Element when you select one.
export default function Inspector({ article, categories, vendors = [] }: { article?: any; categories: Cat[]; vendors?: { id: string; name: string }[] }) {
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
      <div className="mb-4 flex gap-1 rounded-xl border border-[var(--border)] p-1">
        <button type="button" onClick={() => setTab('article')} className={btn(tab === 'article')}>Article details</button>
        <button type="button" onClick={() => setTab('element')} className={btn(tab === 'element')}>Element{selected ? ' •' : ''}</button>
      </div>
      <div className={tab === 'article' ? '' : 'hidden'}><ArticleDetails article={article} categories={categories} vendors={vendors} /></div>
      <div className={tab === 'element' ? '' : 'hidden'}><ElementInspector /></div>
    </div>
  );
}
