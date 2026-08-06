'use client';
import parse, { Element } from 'html-react-parser';
import { BrandMark } from '@/components/BrandLogo';
import { Megaphone, BarChart } from '@/components/icons';

export type EmbedOpt = { id: string; title: string };

// Renders composed article HTML into the real reader look, swapping the element
// placeholders (author card, ad slot, poll/quiz) for their rendered form. Plain
// text/headings/lists/quotes/images/dividers/buttons/spacers pass straight
// through and are styled by the .prose-article CSS — so the clipping tool still
// sees ordinary selectable text exactly as before.
export default function ArticleContent({
  html, polls = [], quizzes = [], adFor,
}: { html: string; polls?: EmbedOpt[]; quizzes?: EmbedOpt[]; adFor?: (adId: string, label: string) => React.ReactNode }) {
  const content = parse(html || '', {
    replace: (node) => {
      if (!(node instanceof Element) || !node.attribs) return;
      const a = node.attribs;
      if ('data-author' in a) return <AuthorCard a={a} />;
      if ('data-ad-slot' in a) return adFor ? <>{adFor(a['data-ad-id'] || '', a['data-ad-label'] || '')}</> : <AdPlaceholder label={a['data-ad-label']} />;
      if ('data-poll' in a) return <EmbedCard kind="Poll" title={polls.find((p) => p.id === a['data-poll'])?.title || a['data-label'] || 'Poll'} />;
      if ('data-quiz' in a) return <EmbedCard kind="Pop quiz" title={quizzes.find((q) => q.id === a['data-quiz'])?.title || a['data-label'] || 'Pop quiz'} />;
      return undefined;
    },
  });
  return <div className="prose-article">{content}</div>;
}

function AuthorCard({ a }: { a: Record<string, string> }) {
  const inhouse = a['data-inhouse'] === '1';
  const name = inhouse ? 'RS News' : (a['data-name'] || 'Author');
  const title = inhouse ? 'Editorial Team' : a['data-title'];
  const bio = inhouse ? '' : a['data-bio'];
  return (
    <div className="author-card">
      {inhouse ? <span className="author-avatar grid place-items-center"><BrandMark size={56} className="rounded-full" /></span>
        : a['data-avatar']
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="author-avatar" src={a['data-avatar']} alt="" />
          : <span className="author-avatar grid place-items-center bg-[var(--card)] text-lg font-black text-[var(--muted)]">{name.slice(0, 1).toUpperCase()}</span>}
      <div className="min-w-0">
        <div className="author-name">{name}</div>
        {title ? <div className="author-title">{title}</div> : null}
        {bio ? <div className="author-bio">{bio}</div> : null}
      </div>
    </div>
  );
}

function AdPlaceholder({ label }: { label?: string }) {
  return (
    <div className="my-6 grid place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-soft)] px-4 py-8 text-center">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]"><Megaphone width={14} height={14} /> Advertisement</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{label ? label : 'Best-match ad appears here'}</div>
    </div>
  );
}

function EmbedCard({ kind, title }: { kind: string; title: string }) {
  return (
    <div className="my-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-4 dark:border-brand-900 dark:bg-brand-950/30">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-600"><BarChart width={14} height={14} /> {kind}</div>
      <div className="mt-1 font-bold">{title}</div>
      <div className="text-xs text-[var(--muted)]">Interactive on the published article.</div>
    </div>
  );
}
