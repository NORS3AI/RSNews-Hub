import Link from 'next/link';
import type { ArticleWithMeta } from '@/lib/types';

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ArticleCard({
  article,
  featured = false,
}: {
  article: ArticleWithMeta;
  featured?: boolean;
}) {
  return (
    <article
      className={`card group flex flex-col overflow-hidden transition-shadow hover:shadow-md ${
        featured ? 'sm:col-span-2 lg:col-span-3' : ''
      }`}
    >
      <Link href={`/articles/${article.slug}`} className="flex flex-1 flex-col">
        <div
          className={`relative w-full overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 ${
            featured ? 'aspect-[21/9]' : 'aspect-[16/9]'
          }`}
        >
          {article.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.cover_image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-center text-2xl font-bold text-white/90">
              {article.title}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {article.category_name && (
              <span className="badge bg-brand-50 text-brand-700">{article.category_name}</span>
            )}
            <span>{formatDate(article.published_at)}</span>
          </div>
          <h3
            className={`font-bold text-slate-900 group-hover:text-brand-700 ${
              featured ? 'text-2xl' : 'text-lg'
            }`}
          >
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">{article.excerpt}</p>
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>{article.author_name || 'RSNews'}</span>
            <span>{article.views} views</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
