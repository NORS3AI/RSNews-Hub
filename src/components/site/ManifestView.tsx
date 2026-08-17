import Link from 'next/link';
import type { ViewManifest, ManifestBlock } from '@/lib/manifest';

// A generic, page-agnostic renderer: give it ANY ViewManifest and it draws the
// blocks. It knows nothing about Prisma, categories, or which page it's for — it
// only understands the block vocabulary. Swap this for a different renderer (a
// native app, an AI-composed layout) and the Data/Logic layers don't move. That
// is the whole point of the three-layer split (see ARCHITECTURE.md, Phase 4).
export default function ManifestView({ manifest }: { manifest: ViewManifest }) {
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        {manifest.blocks.map((block, i) => <Block key={i} block={block} />)}
      </div>
    </div>
  );
}

function Block({ block: b }: { block: ManifestBlock }) {
  switch (b.type) {
    case 'heading':
      return b.level === 1
        ? <h1 className="text-3xl font-black tracking-tight" style={b.color ? { color: b.color } : undefined}>{b.text}</h1>
        : <h2 className="text-xl font-bold" style={b.color ? { color: b.color } : undefined}>{b.text}</h2>;
    case 'text':
      return <p className={b.tone === 'muted' ? 'text-[var(--muted)]' : ''}>{b.text}</p>;
    case 'empty':
      return <p className="text-[var(--muted)]">{b.text}</p>;
    case 'article-card':
      return (
        <Link href={b.href} className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:shadow-[var(--shadow-hover)]">
          <div className="flex flex-wrap items-center gap-2">
            {b.category && <span className="badge cat-badge" style={{ '--c': b.category.color } as React.CSSProperties}>{b.category.name}</span>}
            {b.partner && <span className="badge border border-[var(--border)] bg-[var(--bg-soft)] font-bold uppercase tracking-wide text-[var(--muted)]">Partner content</span>}
          </div>
          <h3 className="mt-1.5 text-lg font-extrabold leading-tight tracking-tight">{b.title}</h3>
          {b.excerpt && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{b.excerpt}</p>}
        </Link>
      );
    default:
      return null;
  }
}
