'use client';
import { StarProvider } from './StarProvider';
import { ArticleModalProvider } from './ArticleModalProvider';
import { GenresProvider } from './GenresProvider';
import ReaderClipper from './ReaderClipper';
import AnalyticsProvider from './AnalyticsProvider';
import type { GenreInfo } from '@/lib/genre';

/**
 * Wraps the public site with the star store + article-modal store + the live
 * genre map (so every genre badge resolves its label/color from the admin-editable
 * list). The modal and its state mount once for the whole site. The pinned
 * "starred" strip is rendered by the layout (inside the sticky header cluster).
 */
export default function SiteProviders({ children, genres = {} }: { children: React.ReactNode; genres?: Record<string, GenreInfo> }) {
  return (
    <GenresProvider map={genres}>
      <StarProvider>
        <ArticleModalProvider>{children}</ArticleModalProvider>
        <ReaderClipper />
        <AnalyticsProvider />
      </StarProvider>
    </GenresProvider>
  );
}
