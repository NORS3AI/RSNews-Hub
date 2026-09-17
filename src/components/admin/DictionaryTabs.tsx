'use client';
import { useState } from 'react';
import HouseStyleManager from './HouseStyleManager';
import TagGlossaryManager from './TagGlossaryManager';

type Rule = { id: string; canonical: string; variants: string; forceLowercase: boolean; message: string | null; builtin: boolean; enabled: boolean };
type Term = { id: string; canonical: string; variants: string; builtin: boolean; enabled: boolean };
type Tab = 'style' | 'glossary';

// Two dictionaries share the RS Dictionary page as tabs:
//   • House style — the spellings the Newsroom checker enforces.
//   • Tag glossary — the industry vocabulary the tag suggester draws on.
export default function DictionaryTabs({ rules, terms }: { rules: Rule[]; terms: Term[] }) {
  const [tab, setTab] = useState<Tab>('style');

  const TabBtn = ({ id, label, hint }: { id: Tab; label: string; hint: string }) => (
    <button type="button" onClick={() => setTab(id)}
      className={`-mb-px border-b-2 px-1 pb-2 text-left ${tab === id ? 'border-brand-500 text-[var(--fg)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'}`}>
      <span className="block text-sm font-bold">{label}</span>
      <span className="block text-[11px] font-normal text-[var(--muted)]">{hint}</span>
    </button>
  );

  return (
    <div>
      <div className="mb-5 flex gap-6 border-b border-[var(--border)]">
        <TabBtn id="style" label="House style" hint="Spellings the checker enforces" />
        <TabBtn id="glossary" label="Tag glossary" hint="Words the tag suggester knows" />
      </div>

      {tab === 'style' ? (
        <>
          <p className="mb-5 text-sm text-[var(--muted)]">
            The house dictionary the <b>Newsroom</b> checker enforces. Give each term its correct spelling and the off-house versions to flag (e.g. correct <b>e-commerce</b>, catch <i>ecommerce</i>, <i>e commerce</i>). The checker highlights matches in a draft and offers one-click fixes — it never rewrites anything on its own. The Oxford comma is always checked too.
          </p>
          <HouseStyleManager list={rules} />
        </>
      ) : (
        <>
          <p className="mb-5 text-sm text-[var(--muted)]">
            The industry vocabulary the <b>tag suggester</b> draws on. When you hit <b>Suggest</b> in the article editor (or push a draft from the Newsroom), any of these terms found in the story becomes a tag. Add the services, products, and company names you cover — e.g. <b>e-commerce</b>, <b>fulfillment</b>, <b>mailboxes</b>, <b>printing</b> — and the suggester will start proposing them. It also reuses tags you&apos;ve already applied to other articles.
          </p>
          <TagGlossaryManager list={terms} />
        </>
      )}
    </div>
  );
}
