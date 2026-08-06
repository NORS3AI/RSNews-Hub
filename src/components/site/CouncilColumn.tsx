import ArticleLink from './ArticleLink';

export type CouncilItem = { slug: string; title: string; content: string; author: string | null; publishedAt: string };

/**
 * RS Council column — a tall, narrow module that prints every Council piece in
 * full (small type). Each entry is clickable and opens the normal reader modal,
 * where the same text renders at full reading size.
 */
export default function CouncilColumn({ items }: { items: CouncilItem[] }) {
  return (
    <section className="module council-col">
      <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-[#b91c1c] pb-2">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#b91c1c]">RS Council</h2>
        <span className="text-xs font-semibold text-[var(--muted)]">The column</span>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {items.map((a, i) => (
          <ArticleLink key={a.slug} slug={a.slug} className="council-entry group block cursor-pointer py-5 first:pt-0"
            data-trk-type="article" data-trk-id={a.slug} data-trk-place="council" data-trk-props={JSON.stringify({ module: 'council', moduleType: 'column', pos: i, hasImage: false, label: 'council' })}>
            <h3 className="text-[19px] font-extrabold leading-snug tracking-tight group-hover:text-[#b91c1c]">{a.title}</h3>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {a.author ?? 'RS Council'}{a.publishedAt ? ` · ${a.publishedAt}` : ''}
            </div>
            {/* Full column text, small — the same content renders larger in the reader. */}
            <div className="council-body mt-2.5" dangerouslySetInnerHTML={{ __html: a.content }} />
            <span className="mt-2 inline-block text-[12px] font-bold text-[#b91c1c] group-hover:underline">Open full column →</span>
          </ArticleLink>
        ))}
      </div>
    </section>
  );
}
