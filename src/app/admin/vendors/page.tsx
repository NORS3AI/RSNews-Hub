import Link from 'next/link';
import { prisma } from '@/lib/db';
import { saveVendorContact, saveCompetitorGroup, deleteCompetitorGroup, setAdUpdateUrl } from '@/lib/actions';
import { AD_UPDATE_URL_KEY } from '@/lib/vendorReports';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminVendors() {
  const [vendors, adBrandRows, groups, adUpdateUrlRow] = await Promise.all([
    prisma.vendor.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { campaigns: true, reports: true } } },
    }),
    prisma.ad.findMany({ distinct: ['brand'], orderBy: { brand: 'asc' }, select: { brand: true } }),
    prisma.competitorGroup.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.setting.findUnique({ where: { key: AD_UPDATE_URL_KEY } }),
  ]);
  const missingEmail = vendors.filter((v) => !v.contactEmail).length;
  // Every advertiser we can group: distinct ad brands + any vendor names not yet running an ad.
  const advertisers = Array.from(new Set([...adBrandRows.map((a) => a.brand), ...vendors.map((v) => v.name)]))
    .filter(Boolean).sort((a, b) => a.localeCompare(b));

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Vendors</h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        Every advertiser is one vendor record — campaigns and performance reports hang off it. The <strong>contact email</strong> is where flight (&ldquo;fresh ads needed&rdquo;) and renewal reminders are sent. <strong>Each new JotForm order refreshes it</strong> to the email on that order (always the current person); set or fix it here in between orders, or when a submission didn&apos;t include one.
      </p>

      {missingEmail > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <strong>{missingEmail} vendor{missingEmail === 1 ? '' : 's'}</strong> {missingEmail === 1 ? 'has' : 'have'} no contact email — reminder emails can&apos;t reach {missingEmail === 1 ? 'it' : 'them'} until one is set below.
        </div>
      )}

      <form action={setAdUpdateUrl} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
        <div className="min-w-64 flex-1">
          <label className="label text-xs">&ldquo;Update your ads&rdquo; link (shown to advertisers on their dashboard)</label>
          <input name="url" type="url" defaultValue={adUpdateUrlRow?.value ?? ''} placeholder="https://form.jotform.com/… or your VP app URL" className="input h-9" />
        </div>
        <button className="btn-outline btn-sm">Save link</button>
        <span className="w-full text-xs text-[var(--muted)] sm:w-auto sm:flex-1">Where the &ldquo;Update your ads&rdquo; button sends advertisers to submit fresh creatives. Leave blank to hide the button.</span>
      </form>

      {vendors.length === 0 ? (
        <p className="text-[var(--muted)]">No vendors yet. They&apos;re created when a campaign is made or a JotForm submission arrives.</p>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <div key={v.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/vendors/${v.id}`} className="font-bold hover:text-brand-600 hover:underline">{v.name}{v.premium ? <span className="ml-2 badge bg-brand-600/15 align-middle text-[10px] text-brand-600">Premium</span> : null}</Link>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="badge bg-[var(--bg-soft)]">{v._count.campaigns} campaign{v._count.campaigns === 1 ? '' : 's'}</span>
                  <span className="badge bg-[var(--bg-soft)]">{v._count.reports} report{v._count.reports === 1 ? '' : 's'}</span>
                  {v.contactEmail
                    ? <span className="badge bg-green-100 text-green-700">✉ {v.contactEmail}</span>
                    : <span className="badge bg-amber-100 text-amber-800">no email</span>}
                </div>
              </div>
              <form action={saveVendorContact} className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
                <input type="hidden" name="vendorId" value={v.id} />
                <div>
                  <label className="label text-xs">Contact email</label>
                  <input name="contactEmail" type="email" defaultValue={v.contactEmail ?? ''} placeholder="ads@vendor.com" className="input h-9 w-64" />
                </div>
                <div className="min-w-40 flex-1">
                  <label className="label text-xs">Notes</label>
                  <input name="notes" defaultValue={v.notes ?? ''} placeholder="Internal notes" className="input h-9" />
                </div>
                <button className="btn-outline btn-sm">Save</button>
                <span className="ml-auto self-center text-xs text-[var(--muted)]">added {formatDate(v.createdAt)}</span>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* ── Competitor groups ─────────────────────────────────────────────── */}
      <div className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 className="mb-1 text-xl font-bold">Competitor groups</h2>
        <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
          Advertisers in the same group never run alongside each other. And if an article <strong>names or is tagged with</strong> one member, the others are held out of <strong>every</strong> ad slot in that article. Add a brand to as many groups as needed.
        </p>

        {groups.length > 0 && (
          <div className="mb-6 space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="font-bold">{g.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {g.brands.split(',').map((b) => b.trim()).filter(Boolean).map((b) => (
                      <span key={b} className="badge bg-[var(--bg-soft)]">{b}</span>
                    ))}
                  </div>
                </div>
                <form action={deleteCompetitorGroup}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="btn-outline btn-sm text-red-600">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}

        {advertisers.length < 2 ? (
          <p className="text-sm text-[var(--muted)]">Add at least two advertisers (create ads) before grouping.</p>
        ) : (
          <form action={saveCompetitorGroup} className="card p-4">
            <div className="mb-3 font-semibold">New group</div>
            <label className="label text-xs">Group name</label>
            <input name="name" placeholder="e.g. Shipping software" className="input mb-3 h-9 max-w-sm" />
            <label className="label text-xs">Advertisers that compete (pick 2+)</label>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {advertisers.map((b) => (
                <label key={b} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="brands" value={b} className="h-4 w-4" /> {b}
                </label>
              ))}
            </div>
            <button className="btn-primary btn-sm mt-4">Create group</button>
          </form>
        )}
      </div>
    </div>
  );
}
