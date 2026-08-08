'use client';
import { useSaved, type SavedItem } from './StarProvider';
import { Star, StarFilled, Pin } from '@/components/icons';
import { classNames } from '@/lib/utils';

/**
 * Two save actions for an article:
 *  - Star = add to Favorites
 *  - Pin  = save to "Pinned" (this is what pins to the top strip)
 *
 * variant "floating" = round icon buttons (used on cards);
 * variant "inline"   = labelled pill buttons (used in the reader).
 */
export default function SaveButtons({
  item, variant = 'floating', tone = 'default',
}: { item: SavedItem; variant?: 'floating' | 'inline'; tone?: 'default' | 'onColor' }) {
  const { isFavorite, isToRead, toggleFavorite, toggleToRead, ready } = useSaved();
  const fav = ready && isFavorite(item.id);
  const read = ready && isToRead(item.id);

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn(); };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <button onClick={stop(() => toggleFavorite(item))} aria-pressed={fav}
          className={classNames('btn-sm', fav ? 'btn-primary' : 'btn-outline')}>
          {fav ? <StarFilled width={15} height={15} /> : <Star width={15} height={15} />}
          {fav ? 'Favorited' : 'Favorite'}
        </button>
        <button onClick={stop(() => toggleToRead(item))} aria-pressed={read}
          className={classNames('btn-sm', read ? 'btn-primary' : 'btn-outline')}>
          <Pin width={15} height={15} />
          {read ? 'Pinned' : 'Pin'}
        </button>
      </div>
    );
  }

  // On a colored surface (e.g. the orange "Published this week" module) the
  // default translucent look has too little contrast to read on/off. `onColor`
  // uses a crisp white outline for off and a SOLID white fill (brand icon) for
  // on, so it's obvious whether an article is starred/pinned.
  const round = tone === 'onColor'
    ? 'grid h-8 w-8 place-items-center rounded-full border shadow-sm transition-colors backdrop-blur border-white/60 bg-white/15 text-white hover:bg-white/30'
    : 'grid h-8 w-8 place-items-center rounded-full border shadow-sm transition-colors backdrop-blur border-black/10 bg-[var(--card)]/85 text-[var(--fg)] hover:text-brand-600 dark:border-white/15';
  const on = tone === 'onColor'
    ? 'border-white bg-white text-brand-600 hover:text-brand-600 shadow-md'
    : 'border-brand-500 bg-brand-500 text-white hover:text-white';

  return (
    <div className="flex gap-1.5">
      <button onClick={stop(() => toggleFavorite(item))} aria-pressed={fav}
        title={fav ? 'In your favorites' : 'Add to favorites'} aria-label="Favorite"
        className={classNames(round, fav && on)}>
        {fav ? <StarFilled width={17} height={17} /> : <Star width={17} height={17} />}
      </button>
      <button onClick={stop(() => toggleToRead(item))} aria-pressed={read}
        title={read ? 'Pinned to top' : 'Pin to top'} aria-label="Pin"
        className={classNames(round, read && on)}>
        <Pin width={17} height={17} />
      </button>
    </div>
  );
}
