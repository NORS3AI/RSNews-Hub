import { prisma } from '@/lib/db';
import { saveAd, deleteAd } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import InArticleAd from '@/components/InArticleAd';

export const dynamic = 'force-dynamic';

const FieldSet = ({ ad }: { ad?: any }) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="label">Brand / advertiser</label><input name="brand" required defaultValue={ad?.brand ?? ''} className="input" placeholder="PostalMate" /></div>
      <div><label className="label">Label (small)</label><input name="label" defaultValue={ad?.label ?? ''} className="input" placeholder="Shipping software" /></div>
    </div>
    <div><label className="label">Headline</label><textarea name="headline" required defaultValue={ad?.headline ?? ''} className="input min-h-[60px]" placeholder="PostalMate — all-in-one shipping & POS…" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="label">CTA text</label><input name="cta" defaultValue={ad?.cta ?? 'Learn more'} className="input" placeholder="Start free trial" /></div>
      <div><label className="label">Link</label><input name="href" defaultValue={ad?.href ?? '#'} className="input" placeholder="https://…" /></div>
    </div>
    <div>
      <label className="label">Competitors — hide this ad if any appear in the article</label>
      <input name="competitors" defaultValue={ad?.competitors ?? ''} className="input" placeholder="ShipRite, Stamps.com, Endicia" />
      <p className="mt-1 text-xs text-[var(--muted)]">Comma-separated rival brand names. This is how you keep this ad away from competitors&apos; articles.</p>
    </div>
    <div>
      <label className="label">Keywords — this ad&apos;s own brand terms (relevance)</label>
      <input name="keywords" defaultValue={ad?.keywords ?? ''} className="input" placeholder="PostalMate, postal mate" />
      <p className="mt-1 text-xs text-[var(--muted)]">Optional. When these appear in an article, this ad is preferred as contextually relevant.</p>
    </div>
    <div className="flex items-center gap-4">
      <div><label className="label">Accent</label><input name="accent" type="color" defaultValue={ad?.accent ?? '#E97D34'} className="input h-10 w-16 p-1" /></div>
      <label className="mt-5 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={ad ? ad.active : true} className="h-4 w-4" /> Active</label>
    </div>
  </>
);

export default async function AdminAds() {
  const ads = await prisma.ad.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Ad management</h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        In-article ads are chosen so they never sit next to a competitor. On each ad, list rival brand names under <strong>Competitors</strong> — if any of those words appear in an article, this ad is suppressed there. <strong>Keywords</strong> are the ad&apos;s own brand terms, used to show it on relevant articles. Homepage and sidebar ads are unaffected. With no ads configured the site falls back to built-in house ads.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <form action={saveAd} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">Add advertiser</h2>
          <FieldSet />
          <button className="btn-primary w-full">Add advertiser</button>
        </form>

        <div className="space-y-3 lg:col-span-2">
          {ads.map((ad) => (
            <details key={ad.id} className="card p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: ad.accent }} />
                  {ad.brand}
                  {!ad.active && <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">paused</span>}
                </span>
                <span className="max-w-[45%] truncate text-xs text-[var(--muted)]">{ad.competitors ? `vs ${ad.competitors}` : 'no competitors set'}</span>
              </summary>
              <div className="mt-4 grid gap-5 border-t border-[var(--border)] pt-4 md:grid-cols-2">
                <form action={saveAd} className="space-y-3">
                  <input type="hidden" name="id" value={ad.id} />
                  <FieldSet ad={ad} />
                  <div className="flex items-center justify-between">
                    <button className="btn-primary btn-sm">Save</button>
                    <ActionButtons actions={[{ label: 'Delete', run: deleteAd.bind(null, ad.id), danger: true, confirm: `Delete the ${ad.brand} ad?` }]} />
                  </div>
                </form>
                <div>
                  <div className="label mb-2">Live preview</div>
                  <InArticleAd ad={ad} slot="preview" size="in-article" />
                </div>
              </div>
            </details>
          ))}
          {ads.length === 0 && <p className="text-[var(--muted)]">No advertisers yet. The site is using built-in house ads until you add some.</p>}
        </div>
      </div>
    </div>
  );
}
