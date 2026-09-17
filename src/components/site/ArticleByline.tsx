import { type ResolvedByline } from '@/lib/byline';

// The little byline under the article title — deliberately just "By {name}" on a
// single line to keep that header row compact. The photo/title/bio live in the
// in-article Author card element, not here. Name resolves to a linked library
// byline, a one-off typed name, or the house "RS News Hub Team" default.
export default function ArticleByline({ byline, className = '' }: { byline: ResolvedByline; className?: string }) {
  return <span className={className}>By {byline.name}</span>;
}
