import { requirementLabel } from '@/lib/entitlements';

type Cat = { name: string; slug: string; color: string };

/** True when a breaking timer is set and still in the future. */
export function isBreaking(breakingUntil?: Date | string | null): boolean {
  if (!breakingUntil) return false;
  const t = new Date(breakingUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
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
  className = '',
}: {
  category?: Cat | null;
  extraCategories?: Cat[];
  breakingUntil?: Date | string | null;
  requirement?: string;
  className?: string;
}) {
  const breaking = isBreaking(breakingUntil);
  if (!breaking && !category && extraCategories.length === 0 && !requirement) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {breaking && (
        <span className="badge animate-pulse bg-red-600 text-white">⚡ Breaking</span>
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
