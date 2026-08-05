import type { CSSProperties } from 'react';
import type { ModuleTree, Block, Shape } from '@/lib/studio';
import { isHexColor } from '@/lib/studio';

// Renders a Module Studio composition tree into a real homepage module. Pure and
// presentational — the same component draws the Studio canvas preview and (once
// wired) the live homepage. RS-Mode-only colors are applied via the `--studio-rs`
// custom property, which only RS-mode CSS reads (see globals.css .studio-fill).
//
// Data-driven blocks (article/ad/poll) render representative placeholders here;
// live-content resolution is layered on in a later phase. Heading/text render
// their real content immediately.

function rsStyle(color?: string | null): CSSProperties | undefined {
  return color && isHexColor(color) ? ({ ['--studio-rs' as any]: color } as CSSProperties) : undefined;
}

const SHAPE_INNER: Record<Shape, string> = {
  column: 'flex flex-col gap-4',
  row: 'studio-row flex gap-4 overflow-x-auto pb-1',
  grid: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  card: 'flex flex-col gap-3',
};

// In a horizontal row, each child needs a sensible min width so it doesn't
// collapse; elsewhere children fill their track.
function childWidth(shape: Shape): string {
  return shape === 'row' ? 'w-64 shrink-0' : 'w-full';
}

export default function CustomModule({ tree, title }: { tree: ModuleTree; title?: string }) {
  return (
    <section className="module studio-fill" style={rsStyle(tree.rsColor)} data-shape={tree.shape}>
      {title ? <h2 className="module-title mb-4">{title}</h2> : null}
      {tree.children.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">This module is empty.</p>
      ) : (
        <div className={SHAPE_INNER[tree.shape]}>
          {tree.children.map((b) => (
            <div key={b.id} className={childWidth(tree.shape)}>
              <BlockView block={b} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
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
    case 'ad':
      return (
        <div className="studio-fill studio-ad grid min-h-[90px] place-items-center rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4 text-center" style={style}>
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Advertisement</span>
        </div>
      );
    case 'poll': {
      const options = Array.isArray(s.options) ? (s.options as unknown[]).map(String).filter(Boolean) : [];
      return (
        <div className="studio-fill card p-4" style={style}>
          <div className="mb-2 text-sm font-bold">{String(s.question || 'Reader poll')}</div>
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
