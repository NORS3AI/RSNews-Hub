import { pickInArticleAd } from '@/lib/ads';
import AdSlot from '@/components/AdSlot';

/**
 * A house ad rendered inside an article, chosen so it never competes with a
 * brand the article discusses (see lib/ads). No hooks — safe to render on the
 * server (full article page) or the client (modal reader). Falls back to the
 * neutral placeholder if nothing safe is available.
 */
export default function InArticleAd({
  context, slot, size = 'in-article',
}: { context: string; slot: string; size?: 'in-article' | 'rectangle' }) {
  const ad = pickInArticleAd(context, slot);
  if (!ad) return <AdSlot size={size} slot={slot} />;

  const rect = size === 'rectangle';
  return (
    <div
      data-ad-slot={slot}
      data-ad-brand={ad.brand}
      aria-label="Advertisement"
      className={`mx-auto w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] ${rect ? 'max-w-[340px]' : ''}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="h-1" style={{ background: ad.accent }} />
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white" style={{ background: ad.accent }}>Ad</span>
          <span className="text-xs font-bold text-[var(--fg)]">{ad.brand}</span>
          <span className="ml-auto text-[11px] text-[var(--muted)]">{ad.label}</span>
        </div>
        <p className="text-[15px] font-semibold leading-snug text-[var(--fg)]">{ad.headline}</p>
        <a href={ad.href} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-white" style={{ background: ad.accent }}>
          {ad.cta} →
        </a>
      </div>
    </div>
  );
}
