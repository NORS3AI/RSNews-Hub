import type { CSSProperties } from 'react';
import type { ModuleTree, Block, Shape } from '@/lib/studio';
import { isHexColor } from '@/lib/studio';

// Renders a Module Studio composition tree into a real homepage module. Pure and
// presentational — the same component draws the Studio canvas preview and the
// live homepage. RS-Mode-only colors are applied via the `--studio-rs` custom
// property, which only RS-mode CSS reads (see globals.css .studio-fill).
//
// Data-driven blocks (article/ad/poll/quiz) render representative placeholders
// here; the live homepage swaps in real content (see docs/page.tsx). Heading,
// text and image render their real content immediately.

export function rsStyle(color?: string | null): CSSProperties | undefined {
  return color && isHexColor(color) ? ({ ['--studio-rs' as any]: color } as CSSProperties) : undefined;
}

const SHAPE_INNER: Record<Shape, string> = {
  column: 'flex flex-col gap-4',
  sidebar: 'flex flex-col gap-3',
  row: 'studio-row flex gap-4 overflow-x-auto pb-1',
  grid: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  card: 'flex flex-col gap-3',
};
export function shapeInnerClass(shape: Shape): string {
  return SHAPE_INNER[shape];
}

// A horizontal row gives each child a min width; a sidebar is a skinny column
// whose contents shrink to fit (with a font floor, see .studio-sidebar).
export function childWidthClass(shape: Shape): string {
  if (shape === 'row') return 'w-64 shrink-0';
  return 'w-full';
}

// Extra classes for the module frame itself, per shape (e.g. the sidebar's
// narrow width + font-scaling hook).
export function shapeContainerClass(shape: Shape): string {
  return shape === 'sidebar' ? 'studio-sidebar max-w-xs' : '';
}

export default function CustomModule({ tree, title }: { tree: ModuleTree; title?: string }) {
  return (
    <section className={`module studio-fill ${shapeContainerClass(tree.shape)}`} style={rsStyle(tree.rsColor)} data-shape={tree.shape}>
      {title ? <h2 className="module-title mb-4">{title}</h2> : null}
      {tree.children.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">This module is empty.</p>
      ) : (
        <div className={SHAPE_INNER[tree.shape]}>
          {tree.children.map((b) => (
            <div key={b.id} className={childWidthClass(tree.shape)}>
              <BlockView block={b} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BlockView({ block }: { block: Block }) {
  const style = rsStyle(block.rsColor);
  const s = block.settings;
  switch (block.type) {
    case 'heading': {
      const level = s.level === 3 ? 3 : 2;
      const text = String(s.text ?? 'Section title');
      return level === 3
        ? <h3 className="text-lg font-bold tracking-tight">{text}</h3>
        : <h2 className="text-xl font-black tracking-tight">{text}</h2>;
    }
    case 'text':
      return <div className="prose-article text-[15px] leading-relaxed">{String(s.body ?? '')}</div>;
    case 'image': {
      const url = String(s.url ?? '');
      const w = Number(s.widthPct) || 100;
      const radius = s.radius !== false;
      if (!url) {
        return <div className="grid aspect-[16/9] w-full place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-soft)] text-xs text-[var(--muted)]">Image — set a URL in settings</div>;
      }
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={url} alt={String(s.alt ?? '')} style={{ width: `${w}%` }} className={`h-auto max-w-none ${radius ? 'rounded-xl' : ''}`} />;
    }
    case 'ad': {
      const format = String(s.format ?? 'rectangle');
      const h = format === 'leaderboard' ? 'min-h-[60px]' : format === 'video' ? 'min-h-[150px]' : 'min-h-[90px]';
      return (
        <div className={`studio-fill studio-ad grid ${h} place-items-center rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4 text-center`} style={style}>
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{format === 'video' ? 'Video ad' : 'Advertisement'}</span>
        </div>
      );
    }
    case 'quiz':
      return (
        <div className="studio-fill card grid min-h-[90px] place-items-center p-4 text-center" style={style}>
          <span className="text-sm font-bold text-[var(--muted)]">Pop Quiz — shows the current quiz</span>
        </div>
      );
    case 'poll': {
      const options = Array.isArray(s.options) ? (s.options as unknown[]).map(String).filter(Boolean) : [];
      const pie = s.chart === 'pie';
      return (
        <div className="studio-fill card p-4" style={style}>
          <div className="mb-2 text-sm font-bold">{String(s.question || 'Reader poll')}{pie ? ' · pie' : ''}</div>
          <ul className="space-y-1.5">
            {(options.length ? options : ['Option one', 'Option two']).map((o, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-3 py-1.5 text-sm">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--muted)]" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'article-headline':
      return (
        <article className="studio-fill card overflow-hidden p-3.5" style={style}>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-brand-600">{String(s.source ?? 'latest')}</div>
          <h3 className="studio-fit mt-1 font-black leading-tight tracking-tight">Sample headline that fills the row</h3>
        </article>
      );
    case 'article':
    case 'article-image': {
      const withImage = block.type === 'article-image';
      return (
        <article className="studio-fill card card-hover overflow-hidden" style={style}>
          {withImage && <div className="aspect-[16/9] w-full bg-[var(--bg-soft)]" aria-hidden />}
          <div className="p-3.5">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">{String(s.source ?? 'latest')}</div>
            <h4 className="mt-1 text-base font-bold leading-snug">Sample headline goes here</h4>
            {s.showDek !== false && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">A short standfirst previewing the story sits here in the live module.</p>}
          </div>
        </article>
      );
    }
    default:
      return null;
  }
}
