'use client';
import { useStars, type Star } from './StarProvider';
import { Star as StarIcon, StarFilled } from '@/components/icons';
import { classNames } from '@/lib/utils';

/**
 * Star/pin toggle. Used on cards (floating) and inside the reader modal.
 */
export default function StarButton({
  item, size = 18, variant = 'floating',
}: { item: Star; size?: number; variant?: 'floating' | 'inline' }) {
  const { isStarred, toggle, ready } = useStars();
  const starred = ready && isStarred(item.id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  };

  if (variant === 'inline') {
    return (
      <button onClick={onClick} aria-pressed={starred}
        className={classNames('btn-sm', starred ? 'btn-primary' : 'btn-outline')}>
        {starred ? <StarFilled width={15} height={15} /> : <StarIcon width={15} height={15} />}
        {starred ? 'Starred' : 'Star'}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={starred ? 'Remove star' : 'Star this article'}
      aria-pressed={starred}
      title={starred ? 'Starred — pinned to the top' : 'Star this article'}
      className={classNames(
        'grid place-items-center rounded-full border backdrop-blur transition-colors',
        'h-8 w-8 shadow-sm',
        starred
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-black/10 bg-white/85 text-ink-700 hover:bg-white dark:border-white/15 dark:bg-black/40 dark:text-ink-100',
      )}
    >
      {starred ? <StarFilled width={size} height={size} /> : <StarIcon width={size} height={size} />}
    </button>
  );
}
