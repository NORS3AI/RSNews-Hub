import { Clock, Eye } from './icons';
import { formatDate } from '@/lib/utils';
import type { ArticleCard as Card } from '@/lib/recommend';
import ArticleBadges, { isPartnerContent } from './ArticleBadges';
import ArticleLink from './site/ArticleLink';
import StarButton from './site/StarButton';
import AdminArticleEdit from './site/AdminArticleEdit';

export default function ArticleCard({ article, compact = false, trk, hpId = true }: { article: Card; compact?: boolean; trk?: { place?: string; props?: Record<string, unknown> }; hpId?: boolean }) {
  const trkAttrs = trk ? {
    'data-trk-type': 'article',
    'data-trk-id': article.id,
    'data-trk-place': trk.place,
    'data-trk-props': JSON.stringify({ ...(trk.props || {}), hasImage: !!article.coverImage, category: article.category?.slug, compact }),
  } : {};
  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden" data-hp-id={hpId ? article.id : undefined} {...trkAttrs}>
      {/* Floating star — sits above the link, doesn't trigger navigation. */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <StarButton item={{ id: article.id, title: article.title, slug: article.slug }} />
      </div>
      {/* Admin-only edit pencil (top-left); inert unless a staff viewer opted in. */}
      <AdminArticleEdit id={article.id} />

      <ArticleLink slug={article.slug} className="flex h-full flex-col">
        {/* Uniform cover slot: every non-compact card shows an image (or a
            branded placeholder), so a carousel never mixes image + no-image cards. */}
        {!compact && (
          article.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.coverImage} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" style={article.coverFocus ? { objectPosition: article.coverFocus } : undefined} />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] text-3xl font-black text-black/10 dark:from-[#33303a] dark:to-[#201d28] dark:text-white/10">RS</div>
          )
        )}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <ArticleBadges
            className="mb-2"
            category={article.category}
            extraCategories={article.extraCategories}
            breakingUntil={article.breakingUntil}
            requirement={article.requirement}
            genre={article.genre}
            partner={isPartnerContent(article)}
          />
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
