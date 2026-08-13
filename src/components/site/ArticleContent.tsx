'use client';
import parse, { Element } from 'html-react-parser';
import type { AdRow } from '@/lib/ads';
import InArticleAd from '@/components/InArticleAd';
import PollCard, { type PollData } from '@/components/site/PollCard';
import QuizCard, { type QuizData } from '@/components/site/QuizCard';
import { BrandMark } from '@/components/BrandLogo';
import { Megaphone, BarChart } from '@/components/icons';

export type EmbedOpt = { id: string; title: string };
export type LivePoll = { data: PollData; votedOptionId: string | null };
export type LiveQuiz = { data: QuizData; done: boolean };

// Renders composed article HTML into the real reader look, expanding the element
// placeholders (author card, ad slot, poll/quiz) into their rendered form. Plain
// text/headings/lists/quotes/images/dividers/buttons/spacers pass straight
// through and are styled by .prose-article — so the clipping tool still sees
// ordinary selectable text. Returns a fragment; the caller supplies the
// .prose-article / [data-reader] wrapper.
//
// On the live reader, pass `pollData`/`quizData` (+ `loggedIn`) to render real,
// votable cards. Without them — e.g. the composer preview — poll/quiz embeds show
// a static placeholder using the `polls`/`quizzes` title list.
export default function ArticleContent({
  html, polls = [], quizzes = [], ads = [], adBySlot = {}, adById = {}, pollData = [], quizData = [], loggedIn = false, adminPreview = false,
}: {
  html: string; polls?: EmbedOpt[]; quizzes?: EmbedOpt[]; ads?: AdRow[]; adBySlot?: Record<string, AdRow>; adById?: Record<string, AdRow>;
  pollData?: LivePoll[]; quizData?: LiveQuiz[]; loggedIn?: boolean;
  // `adminPreview` = the admin composer preview, where an un-hooked ad slot SHOULD
  // show a placeholder so the editor sees it. On every live reader surface (page,
  // modal, shared preview link) this is false → an ad element with no live creative
  // collapses to nothing. A reader must never see the orange/dashed placeholder.
  adminPreview?: boolean;
}) {
  let adIdx = 0;
  const content = parse(html || '', {
    replace: (node) => {
      if (!(node instanceof Element) || !node.attribs) return;
      const a = node.attribs;
      if ('data-author' in a) return <AuthorCard a={a} />;
      if ('data-ad-slot' in a) {
        const size = a['data-ad-size'] === 'rectangle' ? 'rectangle' : 'in-article';
        // A slot locked to an advertiser shows that advertiser's live creative in
        // the chosen shape; otherwise it auto-rotates the best-match, competitor-safe ads.
        const locked = a['data-ad-brand'] ? adBySlot[`${a['data-ad-brand']}::${a['data-ad-size'] || 'wide'}`] : undefined;
        if (locked) return <div className="my-6"><InArticleAd ad={locked} slot="article-inline" size={size} placeholder={adminPreview} /></div>;
        if (ads.length) { const ad = ads[adIdx++ % ads.length]; return <div className="my-6"><InArticleAd ad={ad} slot="article-inline" size={size} placeholder={adminPreview} /></div>; }
        // No live ad for this slot: show the placeholder only in the composer;
        // on a live reader surface collapse to nothing.
        return adminPreview ? <AdPlaceholder label={a['data-ad-label']} /> : <></>;
      }
      // A hand-picked reserved sponsor creative — always a rectangle. If it didn't
      // resolve (deleted, or DROPPED because it belongs to a different vendor than
      // this article is locked to), collapse to nothing — never print the missing
      // ad's brand label, so a competitor's NAME can't surface in a locked article.
      if ('data-ad-id' in a) {
        const ad = adById[a['data-ad-id']];
        if (ad) return <div className="my-6"><InArticleAd ad={ad} slot="article-sponsor" size="rectangle" placeholder={adminPreview} /></div>;
        return <></>;
      }
      if ('data-poll' in a) {
        const live = pollData.find((p) => p.data.id === a['data-poll']);
        if (live) return <div className="my-6"><PollCard poll={live.data} loggedIn={loggedIn} votedOptionId={live.votedOptionId} /></div>;
        return <EmbedCard kind="Poll" title={polls.find((p) => p.id === a['data-poll'])?.title || a['data-label'] || 'Poll'} />;
      }
      if ('data-quiz' in a) {
        const live = quizData.find((q) => q.data.id === a['data-quiz']);
        if (live) return <div className="my-6"><QuizCard quiz={live.data} loggedIn={loggedIn} initialDone={live.done} /></div>;
        return <EmbedCard kind="Pop quiz" title={quizzes.find((q) => q.id === a['data-quiz'])?.title || a['data-label'] || 'Pop quiz'} />;
      }
      return undefined;
    },
  });
  return <>{content}</>;
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
