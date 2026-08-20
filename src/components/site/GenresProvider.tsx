'use client';
import { createContext, useContext } from 'react';
import { genreInfo, SPONSORED_GENRE, BUILTIN_GENRES, type GenreInfo } from '@/lib/genre';

// The live genre map (slug → label/color) flows from the server layout (getGenreMap)
// into this context, so every badge resolves its display from the admin-editable
// list without threading a map through card DTOs. The default value is the built-in
// seed, so badges still render correctly if a subtree mounts outside the provider.
type GenreMap = Record<string, GenreInfo>;
const BUILTIN_MAP: GenreMap = Object.fromEntries(BUILTIN_GENRES.map((g) => [g.slug, g]));
const Ctx = createContext<GenreMap>(BUILTIN_MAP);

export function GenresProvider({ map, children }: { map: GenreMap; children: React.ReactNode }) {
  return <Ctx.Provider value={map}>{children}</Ctx.Provider>;
}

/** The live slug → display map (built-ins as fallback when no provider). */
export function useGenres(): GenreMap {
  return useContext(Ctx);
}

/**
 * The small editorial-genre chip (Opinion, Update, a custom "History"…). Resolves
 * its label + tint color from the live genre map, so an admin renaming or
 * recoloring a genre updates every badge. Renders nothing for a blank/unknown
 * genre. When the piece is disclosed partner content, the 'sponsored' chip is
 * suppressed so paid content shows one clear "Partner content" label, not two.
 */
export function GenreBadge({ genre, partner = false, className = '' }: { genre?: string | null; partner?: boolean; className?: string }) {
  const map = useGenres();
  const info = genreInfo(genre, map);
  if (!info) return null;
  if (partner && info.slug === SPONSORED_GENRE) return null;
  return (
    <span className={`badge cat-badge font-bold uppercase tracking-wide ${className}`} style={{ '--c': info.color } as React.CSSProperties}>
      {info.label}
    </span>
  );
}
