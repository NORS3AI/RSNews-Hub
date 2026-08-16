// The canonical "article card" — the one shape every list/grid/feed surface
// renders (homepage, category, tag, search, recommendations, endless feed). It's
// deliberately a small, presentation-agnostic DATA shape: teaser fields only,
// NEVER the article body, and a derived `sponsored` boolean instead of the
// internal vendor id. Any UI (today's React, a future AI-composed frontend, a
// native app) can consume this without touching the query. Defined once here so
// the select + mapper can't drift across surfaces.

/** A single article as it appears in any card/list. Teaser fields only. */
export type ArticleCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  coverVideo?: string | null;
  coverFocus?: string | null;
  publishedAt: Date | null;
  views: number;
  readMinutes: number;
  category: { name: string; slug: string; color: string } | null;
  extraCategories: { name: string; slug: string; color: string }[];
  breakingUntil: Date | null;
  tags: { name: string; slug: string }[];
  requirement?: string;
  genre?: string;
  // Derived (never the raw vendor id): true when the article is tied to a paying
  // vendor, so cards can show the "Partner content" disclosure. See toCard.
  sponsored?: boolean;
};

/** Prisma `select` that fetches exactly the card fields. Extend with a spread
 *  (`{ ...cardSelect, categoryId: true }`) when a query needs a few extra fields;
 *  never fork the base. */
export const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  coverVideo: true,
  coverFocus: true,
  publishedAt: true,
  views: true,
  readMinutes: true,
  requirement: true,
  genre: true,
  breakingUntil: true,
  sponsorVendorId: true,
  category: { select: { name: true, slug: true, color: true } },
  extraCategories: { select: { name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;

/** Map a raw `cardSelect` row to an `ArticleCard`: flatten tags and convert the
 *  internal `sponsorVendorId` into a public `sponsored` boolean (the vendor id
 *  itself is never shipped to the client). */
export function toCard(a: any): ArticleCard {
  const { sponsorVendorId, tags, ...rest } = a;
  return { ...rest, sponsored: !!sponsorVendorId, tags: (tags ?? []).map((t: any) => t.tag) };
}
