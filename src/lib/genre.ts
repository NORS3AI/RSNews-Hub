// Optional editorial "genre" for an article — the NATURE of the piece, a
// separate axis from topic categories. Blank on most articles; set only when it
// clarifies. 'sponsored' doubles as an ad/paid disclosure. Pure + shared by the
// editor, the save action (whitelist), and the badge display so they never drift.

export type Genre = 'opinion' | 'sponsored' | 'press_release' | 'update';

export const GENRES: { value: Genre; label: string }[] = [
  { value: 'opinion', label: 'Opinion' },
  { value: 'sponsored', label: 'Sponsored' },
  { value: 'press_release', label: 'Press release' },
  { value: 'update', label: 'Update' },
];

const LABEL: Record<string, string> = Object.fromEntries(GENRES.map((g) => [g.value, g.label]));

/** Human label for a genre token, or '' if none/unknown. */
export function genreLabel(v: string | null | undefined): string {
  return (v && LABEL[v]) || '';
}

/** Normalize a submitted genre to a known token, or '' (none). */
export function normalizeGenre(v: unknown): string {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return LABEL[t] ? t : '';
}

// Badge tint per genre — deliberately distinct from the category colours so it
// reads as a different axis. Sponsored is a filled, high-visibility gold because
// it's a disclosure; the others are soft tints.
const BADGE: Record<string, string> = {
  opinion: 'bg-violet-100 text-violet-800',
  sponsored: 'bg-amber-400 text-amber-950',
  press_release: 'bg-slate-200 text-slate-700',
  update: 'bg-blue-100 text-blue-800',
};
export function genreBadgeClass(v: string): string {
  return BADGE[v] ?? 'bg-[var(--card-2)] text-[var(--fg)]';
}
