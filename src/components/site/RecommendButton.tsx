'use client';
import Link from 'next/link';
import { ThumbsUp, ThumbsUpFilled } from '@/components/icons';
import { classNames } from '@/lib/utils';
import { useRecommend } from './RecommendProvider';

const chip = (on: boolean, count: number) => count > 0 && (
  <span className={classNames('ml-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums',
    on ? 'bg-white/25 text-white' : 'bg-brand-500/15 text-brand-600')}>{count}</span>
);
const pill = 'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-bold transition-colors';

/**
 * End-of-article endorsement. A reader who's scrolled this far can say the piece
 * was worth it — a higher-quality signal than a top-of-page tap. State is shared
 * with the top-of-article count via RecommendProvider, so both move together.
 * Recommending requires an account (one human = one recommend), so a signed-out
 * reader sees a "Sign in to recommend" link instead — same pattern as polls/quizzes.
 * Distinct from Favorite/Pin (those are "save for me"; this is "I'd recommend it").
 */
export default function RecommendButton() {
  const { count, on, busy, signedIn, toggle } = useRecommend();

  return (
    <div className="my-8 flex flex-col items-center gap-2.5 border-t border-[var(--border)] pt-8 text-center">
      <p className="text-sm text-[var(--muted)]">Was this worth reading?</p>
      {signedIn ? (
        <button
          onClick={toggle}
          disabled={busy}
          aria-pressed={on}
          aria-label={on ? 'Remove your recommendation' : 'Recommend this article'}
          className={classNames(pill, 'disabled:opacity-70',
            on ? 'border-brand-500 bg-brand-500 text-white hover:bg-brand-600'
               : 'border-brand-500 text-brand-600 hover:bg-brand-500 hover:text-white')}
        >
          {on ? <ThumbsUpFilled width={18} height={18} /> : <ThumbsUp width={18} height={18} />}
          {on ? 'Recommended' : 'Recommend'}
          {chip(on, count)}
        </button>
      ) : (
        <Link href="/login" className={classNames(pill, 'border-brand-500 text-brand-600 hover:bg-brand-500 hover:text-white')}>
          <ThumbsUp width={18} height={18} />
          Sign in to recommend
          {chip(false, count)}
        </Link>
      )}
    </div>
  );
}
