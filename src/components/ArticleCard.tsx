import { Clock, Eye } from './icons';
import { formatDate } from '@/lib/utils';
import { requirementLabel } from '@/lib/entitlements';
import type { ArticleCard as Card } from '@/lib/recommend';
import ArticleLink from './site/ArticleLink';
import StarButton from './site/StarButton';

export default function ArticleCard({ article, compact = false, trk }: { article: Card; compact?: boolean; trk?: { place?: string; props?: Record<string, unknown> } }) {
  const trkAttrs = trk ? {
    'data-trk-type': 'article',
    'data-trk-id': article.id,
    'data-trk-place': trk.place,
    'data-trk-props': JSON.stringify({ ...(trk.props || {}), hasImage: !!article.coverImage, category: article.category?.slug, compact }),
  } : {};
  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden" {...trkAttrs}>
      {/* Floating star — sits above the link, doesn't trigger navigation. */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <StarButton item={{ id: article.id, title: article.title, slug: article.slug }} />
      </div>

      <ArticleLink slug={article.slug} className="flex h-full flex-col">
        {/* Uniform cover slot: every non-compact card shows an image (or a
            branded placeholder), so a carousel never mixes image + no-image cards. */}
        {!compact && (
          article.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.coverImage} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] text-3xl font-black text-black/10 dark:from-[#33303a] dark:to-[#201d28] dark:text-white/10">RS</div>
          )
        )}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {article.category && (
              <span className="badge" style={{ backgroundColor: article.category.color + '22', color: article.category.color }}>
                {article.category.name}
              </span>
            )}
            {article.requirement && (
              <span className="badge bg-amber-100 text-amber-800">🔒 {requirementLabel(article.requirement)}</span>
            )}
          </div>
          {/* Title is never truncated — the card grows to fit it. */}
          <h3 className={`pr-[76px] font-extrabold leading-tight tracking-tight text-[var(--fg)] group-hover:text-brand-600 ${compact ? 'text-lg' : 'text-[22px]'}`}>
            {article.title}
          </h3>
          <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-[var(--muted)]">
            <span>{formatDate(article.publishedAt)}</span>
            <span className="flex items-center gap-1"><Clock width={13} height={13} />{article.readMinutes} min</span>
            <span className="flex items-center gap-1"><Eye width={13} height={13} />{article.views}</span>
          </div>
        </div>
      </ArticleLink>
    </article>
  );
}
