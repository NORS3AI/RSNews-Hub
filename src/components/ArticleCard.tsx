import { Clock, Eye } from './icons';
import { formatDate } from '@/lib/utils';
import type { ArticleCard as Card } from '@/lib/recommend';
import ArticleLink from './site/ArticleLink';
import StarButton from './site/StarButton';

export default function ArticleCard({ article, compact = false }: { article: Card; compact?: boolean }) {
  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden">
      {/* Floating star — sits above the link, doesn't trigger navigation. */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <StarButton item={{ id: article.id, title: article.title, slug: article.slug }} />
      </div>

      <ArticleLink slug={article.slug} className="flex h-full flex-col">
        {article.coverImage && !compact && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverImage} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
        )}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {article.category && (
              <span className="badge" style={{ backgroundColor: article.category.color + '22', color: article.category.color }}>
                {article.category.name}
              </span>
            )}
          </div>
          <h3 className={`pr-8 font-semibold leading-snug text-[var(--fg)] group-hover:text-brand-600 ${compact ? 'text-sm line-clamp-2' : 'text-lg line-clamp-2'}`}>
            {article.title}
          </h3>
          {!compact && article.excerpt && (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{article.excerpt}</p>
          )}
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
