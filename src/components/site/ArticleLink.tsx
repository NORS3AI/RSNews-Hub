'use client';
import { useArticleModal } from './ArticleModalProvider';

/**
 * A normal anchor to the article's canonical URL — so middle-click, ⌘/Ctrl-click,
 * right-click "open in new tab", crawlers and no-JS all still work — but a plain
 * left click opens the big reader modal instead of navigating.
 */
export default function ArticleLink({
  slug, className, children, ...rest
}: { slug: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const { openArticle } = useArticleModal();
  return (
    <a
      href={`/docs/article/${slug}`}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        // Respect new-tab / new-window intents.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as any).button === 1) return;
        e.preventDefault();
        openArticle(slug);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
