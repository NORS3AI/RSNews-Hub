'use client';
import { useState } from 'react';
import { useComposer, type Selected } from './context';
import { uploadImage } from '@/lib/uploadClient';
import { Trash } from '@/components/icons';

const LABELS: Record<string, string> = {
  adSlot: 'Ad slot', reservedAd: 'Sponsor ad', spacer: 'Blank space', pollEmbed: 'Poll', quizEmbed: 'Pop quiz',
  ctaButton: 'Button', author: 'Author card', image: 'Image',
};

export default function ElementInspector() {
  const { selected } = useComposer();
  if (!selected) {
    return <p className="px-1 py-6 text-center text-sm text-[var(--muted)]">Click an element in your story to edit it here.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="text-sm font-black">{LABELS[selected.type] || 'Element'}</div>
      {/* Remount fields when the selected element changes so uncontrolled inputs reset. */}
      <Fields key={`${selected.type}:${selected.pos}`} sel={selected} />
    </div>
  );
}

const AD_SIZES = [{ v: 'wide', label: 'Wide banner' }, { v: 'rectangle', label: 'Rectangle' }] as const;
type Adv = { wide: boolean; rect: boolean; video: boolean };
const advHasSize = (adv: Adv | undefined, size: string) =>
  !adv ? false : size === 'rectangle' ? (adv.rect || adv.video) : adv.wide;
const advHasAnyImage = (adv: Adv | undefined) => !!adv && (adv.wide || adv.rect || adv.video);

function Fields({ sel }: { sel: NonNullable<Selected> }) {
  const { updateSelected, deleteSelected, polls, quizzes, advertisers, reservedAds, bylines } = useComposer();
  const a = sel.attrs as Record<string, any>;
  const [busy, setBusy] = useState(false);
  // Popup shown when the chosen advertiser has no live creative in the chosen size.
  const [sizeGap, setSizeGap] = useState<{ brand: string; size: string } | null>(null);

  // Warn only when the advertiser HAS image creatives but not the chosen shape.
  // A text-only advertiser fits any slot, so it never triggers the popup.
  function checkFit(brandKey: string, size: string) {
    if (!brandKey) { setSizeGap(null); return; }
    const adv = advertisers.find((x) => x.key === brandKey);
    const gap = advHasAnyImage(adv) && !advHasSize(adv, size);
    setSizeGap(gap ? { brand: brandKey, size } : null);
  }

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setBusy(true);
    const r = await uploadImage(f); setBusy(false);
    if (r.ok) updateSelected({ avatar: r.url });
    e.target.value = '';
  }

  let body: React.ReactNode = null;
  if (sel.type === 'adSlot') {
    const size = a.size || 'wide';
    const gapAdv = sizeGap ? advertisers.find((x) => x.key === sizeGap.brand) : undefined;
    const otherSizes = AD_SIZES.filter((s) => s.v !== (sizeGap?.size ?? '') && advHasSize(gapAdv, s.v));
    body = (
      <div className="space-y-3">
        <div>
          <label className="label">Size</label>
          <div className="flex gap-1.5">
            {AD_SIZES.map((s) => (
              <button key={s.v} type="button" onClick={() => { updateSelected({ size: s.v }); checkFit(a.brand || '', s.v); }}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-bold ${size === s.v ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30' : 'border-[var(--border)] text-[var(--muted)]'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Advertiser</label>
          <select className="input" value={a.brand || ''} onChange={(e) => {
            const key = e.target.value; const label = advertisers.find((x) => x.key === key)?.brand || '';
            updateSelected({ brand: key, adLabel: label }); checkFit(key, size);
          }}>
            <option value="">Auto — smart cycle (contextual + competitor-safe)</option>
            {advertisers.map((x) => <option key={x.key} value={x.key}>{x.brand}</option>)}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">Auto rotates the best-match ad and hides an advertiser&apos;s rivals. Or lock this slot to one advertiser.</p>
        </div>

        {sizeGap && gapAdv && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-semibold text-amber-800 dark:text-amber-200">{gapAdv.brand} has no live {size === 'rectangle' ? 'rectangle' : 'wide banner'} on file.</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {otherSizes.map((s) => (
                <button key={s.v} type="button" onClick={() => { updateSelected({ size: s.v }); setSizeGap(null); }}
                  className="btn-outline btn-sm justify-start">Switch size to {s.label} (they have it)</button>
              ))}
              <button type="button" onClick={() => { updateSelected({ brand: '', adLabel: '' }); setSizeGap(null); }}
                className="btn-outline btn-sm justify-start">Use Auto instead</button>
              <button type="button" onClick={() => setSizeGap(null)}
                className="text-left text-xs text-[var(--muted)] hover:text-[var(--fg)]">Keep it — nothing current on file, a best-match ad shows here instead</button>
            </div>
          </div>
        )}
      </div>
    );
  } else if (sel.type === 'reservedAd') {
    body = (
      <div className="space-y-3">
        <div>
          <label className="label">Sponsor creative</label>
          <select className="input" value={a.adId || ''} onChange={(e) => {
            const id = e.target.value; const ad = reservedAds.find((x) => x.id === id);
            updateSelected({ adId: id, adLabel: ad ? ad.brand : '' });
          }}>
            <option value="">Choose a reserved ad…</option>
            {reservedAds.map((x) => <option key={x.id} value={x.id}>{x.brand} — {x.headline.slice(0, 48)}</option>)}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Only ads marked <strong>Reserved</strong> (in Ads admin) appear here. Renders as a rectangle exactly where this block sits, and never enters the normal rotation.
            {reservedAds.length === 0 && <> No reserved ads yet — add one under <strong>Ads</strong> and tick “Reserved (one-off)”.</>}
          </p>
        </div>
      </div>
    );
  } else if (sel.type === 'image') {
    body = (
      <div className="space-y-2">
        {a.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.src} alt="" className="max-h-32 w-full rounded-lg border border-[var(--border)] object-contain" />
        )}
        <div>
          <label className="label">Alt text</label>
          <input className="input" defaultValue={a.alt || ''} onChange={(e) => updateSelected({ alt: e.target.value })}
            placeholder="e.g. A driver scanning a package at the counter" />
          <p className="mt-1 text-xs text-[var(--muted)]">Describes the image for screen readers and search. It&apos;s never shown on the page, spoken by &ldquo;Listen&rdquo;, or pulled into a clipping.</p>
        </div>
      </div>
    );
  } else if (sel.type === 'spacer') {
    body = (
      <div>
        <label className="label">Height</label>
        <div className="flex gap-1.5">
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button key={s} type="button" onClick={() => updateSelected({ size: s })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-bold ${a.size === s ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30' : 'border-[var(--border)] text-[var(--muted)]'}`}>
              {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (sel.type === 'pollEmbed' || sel.type === 'quizEmbed') {
    const list = sel.type === 'pollEmbed' ? polls : quizzes;
    body = (
      <div>
        <label className="label">Choose {sel.type === 'pollEmbed' ? 'a poll' : 'a quiz'}</label>
        {list.length === 0 ? <p className="text-xs text-[var(--muted)]">None yet — create one first.</p> : (
          <select className="input" defaultValue={a.id || ''} onChange={(e) => {
            const id = e.target.value; const label = list.find((x) => x.id === id)?.title || '';
            updateSelected({ id, label });
          }}>
            <option value="">(select)</option>
            {list.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        )}
      </div>
    );
  } else if (sel.type === 'ctaButton') {
    body = (
      <div className="space-y-2">
        <div><label className="label">Button text</label>
          <input className="input" defaultValue={a.label || ''} onChange={(e) => updateSelected({ label: e.target.value })} placeholder="Learn more" /></div>
        <div><label className="label">Link URL</label>
          <input className="input" defaultValue={a.href || ''} onChange={(e) => updateSelected({ href: e.target.value })} placeholder="https://…" /></div>
      </div>
    );
  } else if (sel.type === 'author') {
    const inhouse = a.inhouse === true || a.inhouse === '1';
    body = (
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={inhouse} onChange={(e) => updateSelected({ inhouse: e.target.checked })} className="h-4 w-4" />
          Written in-house by RS News
        </label>
        {!inhouse && (
          <>
            {/* Fill from the saved-byline library. Linking keeps the card live —
                edit the person in Bylines and every linked card updates. */}
            <div><label className="label">Use a saved byline</label>
              <select className="input" value={String(a.bylineId || '')} onChange={(e) => {
                const b = bylines.find((x) => x.id === e.target.value);
                if (b) updateSelected({ bylineId: b.id, name: b.name, title: b.title ?? '', avatar: b.photo ?? '', bio: b.bio ?? '' });
                else updateSelected({ bylineId: '' });
              }}>
                <option value="">Custom (fill in below)</option>
                {bylines.map((b) => <option key={b.id} value={b.id}>{b.name}{b.title ? ` — ${b.title}` : ''}</option>)}
              </select>
            </div>
            {a.bylineId ? (
              <div className="flex items-center gap-3 rounded-lg border border-brand-500/40 bg-brand-50/40 p-2.5">
                {a.avatar
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--card)] text-xs font-bold text-[var(--muted)]">{String(a.name || '?').slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0 text-xs">
                  <div className="truncate font-bold text-[var(--fg)]">{a.name}</div>
                  <div className="text-[var(--muted)]">Linked — its photo, title &amp; bio stay in sync with the <a href="/admin/bylines" target="_blank" rel="noreferrer" className="text-brand-600 underline">Bylines</a> library. Pick “Custom” to type a one-off.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {a.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--bg-soft)] text-xs font-bold text-[var(--muted)]">RS</span>}
                  <label className="btn-outline btn-sm cursor-pointer">{busy ? 'Uploading…' : a.avatar ? 'Change headshot' : 'Add headshot'}
                    <input type="file" accept="image/*" onChange={pickAvatar} className="hidden" /></label>
                  {a.avatar && <button type="button" onClick={() => updateSelected({ avatar: '' })} className="text-xs text-red-600 hover:underline">Remove</button>}
                </div>
                <div><label className="label">Name</label>
                  <input className="input" defaultValue={a.name || ''} onChange={(e) => updateSelected({ name: e.target.value })} placeholder="Jane Writer" /></div>
                <div><label className="label">Title / role <span className="font-normal text-[var(--muted)]">(optional)</span></label>
                  <input className="input" defaultValue={a.title || ''} onChange={(e) => updateSelected({ title: e.target.value })} placeholder="Guest columnist" /></div>
                <div><label className="label">Bio <span className="font-normal text-[var(--muted)]">(optional)</span></label>
                  <textarea className="input min-h-[64px]" defaultValue={a.bio || ''} onChange={(e) => updateSelected({ bio: e.target.value })} placeholder="A sentence or two about them." /></div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {body}
      <button type="button" onClick={deleteSelected} className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline">
        <Trash width={15} height={15} /> Remove element
      </button>
    </div>
  );
}
