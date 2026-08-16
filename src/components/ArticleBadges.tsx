import { requirementLabel } from '@/lib/entitlements';
import { genreLabel, genreBadgeClass } from '@/lib/genre';

type Cat = { name: string; slug: string; color: string };

/** True when a breaking timer is set and still in the future. */
export function isBreaking(breakingUntil?: Date | string | null): boolean {
  if (!breakingUntil) return false;
  const t = new Date(breakingUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Single source of truth for "this article is paid/advertiser content and must
 *  carry a disclosure": it's tied to a paying vendor OR marked sponsored. Accepts
 *  the raw `sponsorVendorId` (reader page) or a derived `sponsored` boolean (cards
 *  ship the boolean, never the internal vendor id). Used by every surface so they
 *  can't drift apart. */
export function isPartnerContent(a: { sponsorVendorId?: string | null; sponsored?: boolean; genre?: string | null }): boolean {
  return !!a.sponsorVendorId || !!a.sponsored || a.genre === 'sponsored';
}

/**
 * FTC paid-content disclosure. Shown on any article tied to a paying vendor
 * (a premium supplier's "What's Hot" piece) or otherwise marked sponsored — so
 * native/advertiser-written content is disclosed rather than mistaken for
 * independent editorial. Label is "Partner content" (owner's choice), paired with
 * the supplier's company byline which names the source. Note: the FTC prefers an
 * unambiguous term like "Sponsored"; "Partner content" is a lighter disclosure —
 * change the one string below if you want to strengthen it.
 */
export function PartnerContentBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`badge border border-[var(--border)] bg-[var(--bg-soft)] font-bold uppercase tracking-wide text-[var(--muted)] ${className}`}
      title="This article is from a paying premium supplier."
    >
      Partner content
    </span>
  );
}

// The row of badges shown above an article title on cards and in the reader:
// a ⚡ Breaking pill (while its timer is live), the primary category, any extra
// categories, and the access-gate lock. Kept in one place so cards, the article
// page, and the modal stay consistent.
export default function ArticleBadges({
  category,
  extraCategories = [],
  breakingUntil,
  requirement,
  genre,
  partner = false,
  className = '',
}: {
  category?: Cat | null;
  extraCategories?: Cat[];
  breakingUntil?: Date | string | null;
  requirement?: string;
  genre?: string;
  partner?: boolean;
  className?: string;
}) {
  const breaking = isBreaking(breakingUntil);
  const gLabel = genreLabel(genre);
  // The "Paid partner content" disclosure supersedes the plain 'sponsored' genre
  // chip so paid content shows one clear label, not two.
  const showGenre = gLabel && !(partner && genre === 'sponsored');
  if (!breaking && !category && extraCategories.length === 0 && !requirement && !showGenre && !partner) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {breaking && (
        <span className="badge animate-pulse bg-red-600 text-white">⚡ Breaking</span>
      )}
      {partner && <PartnerContentBadge />}
      {showGenre && (
        <span className={`badge font-bold uppercase tracking-wide ${genreBadgeClass(genre!)}`}>{gLabel}</span>
      )}
      {category && (
        <span className="badge cat-badge" style={{ '--c': category.color } as React.CSSProperties}>{category.name}</span>
      )}
      {extraCategories.map((c) => (
        <span key={c.slug} className="badge cat-badge" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span>
      ))}
      {requirement && (
        <span className="badge bg-amber-100 text-amber-800">🔒 {requirementLabel(requirement)}</span>
      )}
    </div>
  );
}
