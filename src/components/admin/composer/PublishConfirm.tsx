'use client';
import { useEffect, useRef, useState } from 'react';
import { useComposer } from './context';
import { publishFlags, hasBlockingFlag, describeTiming, type PublishInput, type AdEntry, type Flag } from '@/lib/publishChecklist';
import { AlertTriangle, Check, X } from '@/components/icons';

type Named = { id: string; name: string };
type ByOpt = { id: string; name: string; title?: string | null };
type GenreOpt = { slug: string; label: string };

type Summary = {
  input: PublishInput;
  flags: Flag[];
  timing: ReturnType<typeof describeTiming>;
  ads: AdEntry[];
};

// A pre-publish confirmation. When the article's status is Published and the main
// Save is pressed, this intercepts the submit, shows a one-look summary of the
// article's settings (byline, date, categories, genre, tags, ads, vendor) plus any
// "look twice" flags, and only submits for real once the editor confirms. Drafts
// and autosaves are never intercepted. Lives inside ComposerProvider so it can read
// the article body for ad slots + Author cards.
export default function PublishConfirm({ categories, genres, bylines, vendors }: {
  categories: Named[]; genres: GenreOpt[]; bylines: ByOpt[]; vendors: Named[];
}) {
  const { html } = useComposer();
  const htmlRef = useRef(html); htmlRef.current = html;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const confirmedRef = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name || '';

  useEffect(() => {
    const form = anchorRef.current?.closest('form') as HTMLFormElement | null;
    formRef.current = form;
    if (!form) return;

    const parseBody = (h: string): { ads: AdEntry[]; authorCards: string[] } => {
      const ads: AdEntry[] = [];
      const authorCards: string[] = [];
      if (typeof window === 'undefined') return { ads, authorCards };
      const doc = new DOMParser().parseFromString(h || '', 'text/html');
      let i = 0;
      doc.querySelectorAll('[data-ad-slot], [data-ad-id]').forEach((el) => {
        i += 1;
        if (el.hasAttribute('data-ad-id')) {
          ads.push({ index: i, kind: 'reserved', brand: '', label: el.getAttribute('data-ad-label') || '' });
        } else {
          ads.push({ index: i, kind: 'slot', size: el.getAttribute('data-ad-size') || 'wide', brand: el.getAttribute('data-ad-brand') || '', label: el.getAttribute('data-ad-label') || '' });
        }
      });
      doc.querySelectorAll('[data-author]').forEach((el) => {
        const bid = el.getAttribute('data-bylineid') || '';
        const name = (el.getAttribute('data-name') || '').trim() || (bid ? (bylines.find((b) => b.id === bid)?.name || '') : '');
        if (name) authorCards.push(name);
      });
      return { ads, authorCards };
    };

    const build = (fd: FormData): Summary => {
      const bylineId = String(fd.get('bylineId') || '');
      const oneOff = String(fd.get('byline') || '').trim();
      const bylineName = bylineId ? (bylines.find((b) => b.id === bylineId)?.name || '') : oneOff;
      const primaryCategory = catName(String(fd.get('categoryId') || ''));
      const extraCategories = fd.getAll('extraCategoryIds').map((v) => catName(String(v))).filter(Boolean);
      const genre = genres.find((g) => g.slug === String(fd.get('genre') || ''))?.label || '';
      const tags = String(fd.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean);
      const vendorId = String(fd.get('sponsorVendorId') || '');
      const connectedVendor = vendors.find((v) => v.id === vendorId)?.name || '';
      const publishedAt = String(fd.get('publishedAt') || '');
      const now = Date.now();
      const { ads, authorCards } = parseBody(htmlRef.current);
      const input: PublishInput = {
        title: String(fd.get('title') || '').trim(),
        bylineName, publishedAt, now,
        primaryCategory, extraCategories, genre, tags, connectedVendor,
        sponsored: !!String(fd.get('sponsoredUntil') || '').trim() || !!vendorId,
        breaking: !!String(fd.get('breakingHours') || ''),
        featured: fd.get('featured') != null,
        pinned: fd.get('pinned') != null,
        ads, authorCards,
      };
      return { input, flags: publishFlags(input), timing: describeTiming(publishedAt, now), ads };
    };

    const onSubmit = (e: SubmitEvent) => {
      if (confirmedRef.current) { confirmedRef.current = false; return; } // our own confirmed re-submit
      const submitter = e.submitter as HTMLElement | null;
      if (!submitter || submitter.getAttribute('data-publish-guard') !== '1') return; // not the main Save
      const fd = new FormData(form);
      if (String(fd.get('status') || '') !== 'PUBLISHED') return; // only when publishing
      e.preventDefault();
      e.stopImmediatePropagation();
      setSummary(build(fd));
    };

    form.addEventListener('submit', onSubmit, { capture: true });
    return () => form.removeEventListener('submit', onSubmit, { capture: true });
    // Bind once; body HTML is read live via htmlRef, and the resolve maps are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => setSummary(null);
  const publish = () => {
    // A hard-blocking conflict (byline vs Author card) can't be published past.
    if (summary && hasBlockingFlag(summary.flags)) return;
    setSummary(null);
    confirmedRef.current = true;
    const form = formRef.current;
    const btn = form?.querySelector('[data-publish-guard="1"]') as HTMLButtonElement | null;
    form?.requestSubmit(btn ?? undefined);
  };

  const s = summary;
  const blocked = !!s && hasBlockingFlag(s.flags);
  const cats = s ? [s.input.primaryCategory, ...s.input.extraCategories].filter(Boolean) : [];

  const Field = ({ label, children, dim }: { label: string; children: React.ReactNode; dim?: boolean }) => (
    <div className="flex gap-3 py-1.5">
      <span className="w-28 shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className={`min-w-0 flex-1 text-sm ${dim ? 'text-[var(--muted)]' : ''}`}>{children}</span>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      {s && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Confirm publish">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Ready to publish?</h2>
              <button type="button" onClick={cancel} className="text-[var(--muted)] hover:text-[var(--fg)]" aria-label="Close"><X width={18} height={18} /></button>
            </div>

            {s.flags.length > 0 && (
              <div className="mb-4 space-y-2">
                {s.flags.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    f.level === 'block' ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
                    : f.level === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                    : 'border-[var(--border)] bg-[var(--bg-soft)] text-[var(--fg)]'}`}>
                    <AlertTriangle width={15} height={15} className={`mt-0.5 shrink-0 ${f.level === 'block' ? 'text-red-600' : f.level === 'warn' ? 'text-amber-600' : 'text-[var(--muted)]'}`} />
                    <span>{f.level === 'block' ? <><b>Must fix — </b>{f.text}</> : f.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">
              <Field label="Title">{s.input.title || <span className="text-red-600">— required</span>}</Field>
              <Field label="Byline (top)" dim={!s.input.bylineName}>{s.input.bylineName || 'RS News Hub Team (house default)'}</Field>
              <Field label="Publish">{s.timing.label}</Field>
              <Field label="Categories" dim={cats.length === 0}>{cats.length ? cats.join(', ') : 'None'}</Field>
              <Field label="Genre" dim={!s.input.genre}>{s.input.genre || '—'}</Field>
              <Field label="Tags" dim={s.input.tags.length === 0}>{s.input.tags.length ? s.input.tags.join(', ') : 'None'}</Field>
              {s.input.connectedVendor && <Field label="Vendor">Locked to <b>{s.input.connectedVendor}</b></Field>}
              {(s.input.featured || s.input.pinned || s.input.breaking || s.input.sponsored) && (
                <Field label="Flags">
                  {[s.input.breaking && 'Breaking', s.input.featured && 'Featured', s.input.pinned && 'Pinned', s.input.sponsored && 'Sponsored'].filter(Boolean).join(' · ')}
                </Field>
              )}
              {s.ads.length > 0 && (
                <Field label={`Ads (${s.ads.length})`}>
                  <ul className="space-y-0.5">
                    {s.ads.map((a) => (
                      <li key={a.index} className="text-[13px]">
                        <span className="text-[var(--muted)]">#{a.index}</span>{' '}
                        {a.kind === 'reserved'
                          ? <>Sponsor creative — <b>{a.label || 'unset'}</b></>
                          : (a.brand || a.label)
                            ? <>{a.size === 'rectangle' ? 'Rectangle' : 'Wide'} — pinned to <b>{a.label || a.brand}</b></>
                            : <>{a.size === 'rectangle' ? 'Rectangle' : 'Wide'} — <span className="text-[var(--muted)]">Auto (competitor-safe)</span></>}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              {blocked && <span className="mr-auto text-xs font-semibold text-red-600">Fix the conflict above to publish.</span>}
              <button type="button" className="btn-outline btn-sm" onClick={cancel}>Back to edit</button>
              <button type="button" className="btn-primary btn-sm disabled:opacity-50" onClick={publish} disabled={blocked}
                title={blocked ? 'Resolve the byline conflict first' : undefined}>
                <Check width={15} height={15} /> Confirm &amp; publish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
