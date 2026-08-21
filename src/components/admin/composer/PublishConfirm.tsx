'use client';
import { useEffect, useRef, useState } from 'react';
import { useComposer } from './context';
import { hasBlockingFlag, publishFlags, type PublishInput, type AdEntry } from '@/lib/publishChecklist';
import PublishChecklistModal, { type ChecklistData } from '../PublishChecklistModal';

type Named = { id: string; name: string };
type ByOpt = { id: string; name: string; title?: string | null };
type GenreOpt = { slug: string; label: string };

// A pre-publish confirmation. When the article's status is Published and the main
// Save is pressed, this intercepts the submit, shows a summary of the article's
// settings + any "look twice" flags, and only submits for real once confirmed
// (and never past a hard-blocking byline conflict). Drafts and autosaves are never
// intercepted. Lives inside ComposerProvider so it can read the body for ad slots
// + Author cards.
export default function PublishConfirm({ categories, genres, bylines, vendors }: {
  categories: Named[]; genres: GenreOpt[]; bylines: ByOpt[]; vendors: Named[];
}) {
  const { html } = useComposer();
  const htmlRef = useRef(html); htmlRef.current = html;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const confirmedRef = useRef(false);
  const [data, setData] = useState<ChecklistData | null>(null);

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

    const build = (fd: FormData): ChecklistData => {
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
      const { ads, authorCards } = parseBody(htmlRef.current);
      const input: PublishInput = {
        title: String(fd.get('title') || '').trim(),
        bylineName, publishedAt, now: Date.now(),
        primaryCategory, extraCategories, genre, tags, connectedVendor,
        sponsored: !!String(fd.get('sponsoredUntil') || '').trim() || !!vendorId,
        breaking: !!String(fd.get('breakingHours') || ''),
        featured: fd.get('featured') != null,
        pinned: fd.get('pinned') != null,
        ads, authorCards,
      };
      return { input, ads };
    };

    const onSubmit = (e: SubmitEvent) => {
      if (confirmedRef.current) { confirmedRef.current = false; return; } // our own confirmed re-submit
      const submitter = e.submitter as HTMLElement | null;
      if (!submitter || submitter.getAttribute('data-publish-guard') !== '1') return; // not the main Save
      const fd = new FormData(form);
      if (String(fd.get('status') || '') !== 'PUBLISHED') return; // only when publishing
      e.preventDefault();
      e.stopImmediatePropagation();
      setData(build(fd));
    };

    form.addEventListener('submit', onSubmit, { capture: true });
    return () => form.removeEventListener('submit', onSubmit, { capture: true });
    // Bind once; body HTML is read live via htmlRef, and the resolve maps are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => setData(null);
  const publish = () => {
    if (data && hasBlockingFlag(publishFlags(data.input))) return; // hard conflict — can't pass
    setData(null);
    confirmedRef.current = true;
    const form = formRef.current;
    const btn = form?.querySelector('[data-publish-guard="1"]') as HTMLButtonElement | null;
    form?.requestSubmit(btn ?? undefined);
  };

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      <PublishChecklistModal data={data} onCancel={cancel} onConfirm={publish} />
    </>
  );
}
