'use client';
import { StarProvider } from './StarProvider';
import { ArticleModalProvider } from './ArticleModalProvider';
import ReaderClipper from './ReaderClipper';
import AnalyticsProvider from './AnalyticsProvider';

/**
 * Wraps the public site with the star store + article-modal store. The modal
 * and its state mount once for the whole site. The pinned "starred" strip is
 * rendered by the layout (inside the sticky header cluster).
 */
export default function SiteProviders({ children }: { children: React.ReactNode }) {
  return (
    <StarProvider>
      <ArticleModalProvider>{children}</ArticleModalProvider>
      <ReaderClipper />
      <AnalyticsProvider />
    </StarProvider>
  );
}
