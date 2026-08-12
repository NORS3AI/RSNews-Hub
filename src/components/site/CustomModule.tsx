import type { CSSProperties } from 'react';
import type { ModuleTree, Block, Shape } from '@/lib/studio';
import { isHexColor, rsTextureUrl } from '@/lib/studio';
import CoverVideo from '@/components/site/CoverVideo';
import Countdown from '@/components/site/Countdown';

// Renders a Module Studio composition tree into a real homepage module. Pure and
// presentational — the same component draws the Studio canvas preview and the
// live homepage. RS-Mode-only colors are applied via the `--studio-rs` custom
// property, which only RS-mode CSS reads (see globals.css .studio-fill).
//
// Data-driven blocks (article/ad/poll/quiz) render representative placeholders
// here; the live homepage swaps in real content (see docs/page.tsx). Heading,
// text and image render their real content immediately.

// Pick a readable ink for text sitting on a solid RS tint. Uses relative
// luminance (WCAG) so light tints get dark-brown ink and dark tints get cream.
export function readableOn(hex: string): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const chan = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(2)) + 0.0722 * lin(chan(4));
  return L > 0.45 ? '#2b2118' : '#f7edd8';
}

export function rsStyle(color?: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  const url = rsTextureUrl(color);
  if (url) return { ['--studio-rs' as any]: 'transparent', ['--studio-rs-img' as any]: `url('${url}')` } as CSSProperties;
  // A solid tint also carries a readable text color so dark tints (ink, green)
  // flip their text to cream automatically.
  if (isHexColor(color)) return { ['--studio-rs' as any]: color, ['--studio-fg' as any]: readableOn(color) } as CSSProperties;
  return undefined;
}

// Small uppercase eyebrow shown above an element when it has a label.
export function Eyebrow({ label }: { label?: string }) {
  return label ? <div className="studio-eyebrow mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-brand-600">{label}</div> : null;
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
  const inner = blockInner(block);
  if (inner == null) return null;
  return <>{block.label ? <Eyebrow label={block.label} /> : null}{inner}</>;
}

function blockInner(block: Block) {
  const style = rsStyle(block.rsColor);
  const s = block.settings;
  switch (block.type) {
    case 'heading': {
      const level = s.level === 3 ? 3 : 2;
      const text = String(s.text ?? 'Section title');
      const seeAllCat = String(s.seeAllCat ?? '').trim();
      const seeAllText = String(s.seeAllText ?? '').trim() || 'See all';
      const H = level === 3
        ? <h3 className="text-lg font-bold tracking-tight">{text}</h3>
        : <h2 className="text-xl font-black tracking-tight">{text}</h2>;
      // Optional "See all →" link (top-right) to a category's archive.
      if (!seeAllCat) return H;
      return (
        <div className="flex items-center justify-between gap-3">
          {H}
          <a href={`/docs/category/${seeAllCat}`} className="shrink-0 whitespace-nowrap text-sm font-semibold text-brand-600 hover:underline">{seeAllText} →</a>
        </div>
      );
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
    case 'video': {
      const url = String(s.url ?? '');
      const w = Number(s.widthPct) || 100;
      const radius = s.radius !== false;
      if (!url) {
        return <div className="grid aspect-[16/9] w-full place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-soft)] text-xs text-[var(--muted)]">Video — upload one in settings</div>;
      }
      return <CoverVideo src={url} poster={String(s.poster ?? '') || null} style={{ width: `${w}%` }} className={`h-auto max-w-none ${radius ? 'rounded-xl' : ''}`} />;
    }
    case 'countdown': {
      const target = String(s.targetAt ?? '');
      if (!target) return <div className="grid min-h-[90px] w-full place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-soft)] text-xs text-[var(--muted)]">Countdown — set a date in settings</div>;
      const title = String(s.title ?? '');
      const href = String(s.href ?? '');
      const doneLabel = String(s.doneLabel ?? '') || "It's here!";
      return (
        <div className="flex flex-col items-center gap-4 py-2">
          {title && <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>}
          <Countdown target={target} variant="big" doneLabel={doneLabel} />
          {href && <span className="btn-primary btn-sm">Learn more →</span>}
        </div>
      );
    }
    case 'ad': {
      const format = String(s.format ?? 'rectangle');
      const h = format === 'leaderboard' ? 'min-h-[60px]' : format === 'video' ? 'min-h-[150px]' : format === 'vertical' ? 'min-h-[250px]' : format === 'square' ? 'min-h-[200px]' : 'min-h-[90px]';
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
    case 'poll':
      return (
        <div className="studio-fill card grid min-h-[90px] place-items-center p-4 text-center" style={style}>
          <span className="text-sm font-bold text-[var(--muted)]">{s.pollId ? `Reader poll · ${s.chart === 'pie' ? 'pie' : 'bars'}` : 'Poll — pick one in settings'}</span>
        </div>
      );
    case 'article-headline':
      return (
        <article className="studio-fill card overflow-hidden p-3.5" style={style}>
          <span className="badge bg-brand-600/15 text-brand-600">Article</span>
          <h3 className="studio-fit mt-1.5 font-black leading-tight tracking-tight">Sample headline that fills the row</h3>
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
    case 'spotlight': {
      const overlay = s.overlay !== false;
      return (
        <article className="studio-fill relative overflow-hidden rounded-2xl border border-[var(--border)]" style={style}>
          <div className="aspect-[16/9] w-full bg-[var(--bg-soft)]" aria-hidden />
          <div className={overlay ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5' : 'p-4'}>
            <span className="badge bg-brand-600/15 text-brand-600">Spotlight</span>
            <h3 className={`mt-1.5 text-2xl font-black leading-tight tracking-tight ${overlay ? 'text-white' : ''}`}>A big featured story</h3>
            {s.showDek !== false && <p className={`mt-1 line-clamp-2 text-sm ${overlay ? 'text-white/80' : 'text-[var(--muted)]'}`}>Its standfirst previews the story in the live module.</p>}
          </div>
        </article>
      );
    }
    case 'split': {
      const right = s.imageSide === 'right';
      const img = <div className="min-h-[130px] w-full bg-[var(--bg-soft)]" aria-hidden />;
      const body = (
        <div className="flex flex-col justify-center p-4">
          <span className="badge bg-brand-600/15 text-brand-600">Feature</span>
          <h3 className="mt-1.5 text-xl font-black leading-tight tracking-tight">A split feature headline</h3>
          {s.showDek !== false && <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">A short standfirst sits alongside the image.</p>}
        </div>
      );
      return (
        <article className="studio-fill card grid overflow-hidden sm:grid-cols-2" style={style}>
          {right ? <>{body}{img}</> : <>{img}{body}</>}
        </article>
      );
    }
    case 'mosaic': {
      const count = Math.min(Math.max(Number(s.count) || 4, 3), 6);
      return (
        <div className="studio-fill grid grid-cols-2 gap-2 sm:grid-cols-3" style={style}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-[var(--border)]">
              <div className="aspect-[16/10] w-full bg-[var(--bg-soft)]" aria-hidden />
              <div className="p-2"><div className="h-2.5 w-full rounded bg-[var(--bg-soft)]" /><div className="mt-1 h-2.5 w-2/3 rounded bg-[var(--bg-soft)]" /></div>
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}
