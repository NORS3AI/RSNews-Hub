// Editorial "genre" — the NATURE of a piece (a separate axis from topic
// categories), shown as a small badge. Genres are admin-editable at runtime (see
// genreServer + /admin/genres); this file is the PURE layer: the built-in seed +
// fallback and the display/validation helpers, so SSR, tests, and the composer
// keep working without a DB round-trip. The DB is the source of truth at runtime.

// The one load-bearing slug: it drives the paid-content (FTC) disclosure and the
// sponsor go-live email. It's a protected built-in — its slug never changes.
export const SPONSORED_GENRE = 'sponsored';

export type GenreInfo = { slug: string; label: string; color: string };

// Built-in genres — seeded into the DB and used as the fallback everywhere.
export const BUILTIN_GENRES: GenreInfo[] = [
  { slug: 'opinion', label: 'Opinion', color: '#8b5cf6' },
  { slug: 'sponsored', label: 'Sponsored', color: '#d97706' },
  { slug: 'press_release', label: 'Press release', color: '#64748b' },
  { slug: 'update', label: 'Update', color: '#3b82f6' },
];
const BUILTIN: Record<string, GenreInfo> = Object.fromEntries(BUILTIN_GENRES.map((g) => [g.slug, g]));

// Resolve a genre slug to its display info from a runtime map (DB) with a
// built-in fallback; null when blank/unknown.
export function genreInfo(slug: string | null | undefined, map?: Record<string, GenreInfo>): GenreInfo | null {
  const s = (slug || '').trim();
  if (!s) return null;
  return (map && map[s]) || BUILTIN[s] || null;
}

/** Human label for a genre slug (built-in fallback), or '' if none/unknown. */
export function genreLabel(slug: string | null | undefined, map?: Record<string, GenreInfo>): string {
  return genreInfo(slug, map)?.label ?? '';
}

/** Badge tint color (hex) for a genre slug, or null if none. */
export function genreColor(slug: string | null | undefined, map?: Record<string, GenreInfo>): string | null {
  return genreInfo(slug, map)?.color ?? null;
}

/** Normalize a submitted genre to an allowed slug, or '' (none). Pass the set of
 *  valid slugs (from the DB) at save time; without it, only built-ins pass. */
export function normalizeGenre(v: unknown, allowed?: Set<string>): string {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!t) return '';
  if (allowed) return allowed.has(t) ? t : '';
  return BUILTIN[t] ? t : '';
}

/** Make a slug from a label for a new custom genre (lowercase, underscores). */
export function genreSlugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}
