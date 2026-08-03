import { classNames } from '@/lib/utils';

type AdSize = 'leaderboard' | 'billboard' | 'rectangle' | 'large-rectangle' | 'half-page' | 'mobile' | 'in-article';

const sizeMeta: Record<AdSize, { label: string; box: string; minH: string }> = {
  leaderboard: { label: '728 × 90', box: 'w-full max-w-[728px] mx-auto', minH: 'min-h-[90px]' },
  billboard: { label: '970 × 250', box: 'w-full', minH: 'min-h-[160px] sm:min-h-[250px]' },
  rectangle: { label: '300 × 250', box: 'w-full max-w-[300px]', minH: 'min-h-[250px]' },
  'large-rectangle': { label: '336 × 280', box: 'w-full max-w-[336px]', minH: 'min-h-[280px]' },
  'half-page': { label: '300 × 600', box: 'w-full max-w-[300px]', minH: 'min-h-[420px]' },
  mobile: { label: '320 × 100', box: 'w-full max-w-[420px] mx-auto', minH: 'min-h-[100px]' },
  'in-article': { label: 'In-article', box: 'w-full', minH: 'min-h-[140px]' },
};

/**
 * Tasteful ad placeholder. Renders a labeled slot that a real ad network
 * (AdSense, GAM, a house campaign, etc.) can later be wired into. The `slot`
 * id is where you'd mount the network's tag.
 */
export default function AdSlot({
  size = 'rectangle', slot, className, label = 'Advertisement',
}: { size?: AdSize; slot?: string; className?: string; label?: string }) {
  const m = sizeMeta[size];
  return (
    <div className={classNames('mx-auto', m.box, className)} data-ad-slot={slot} aria-label="Advertisement">
      <div className={classNames(
        'flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)]',
        'bg-[var(--bg-soft)] px-4 py-3 text-center', m.minH,
      )}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">{label}</span>
        <span className="text-xs text-[var(--muted)]/70">{m.label}</span>
      </div>
    </div>
  );
}
