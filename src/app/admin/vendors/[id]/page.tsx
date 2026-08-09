import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { saveVendorProfile, requestSupplierTestimonials, setTestimonialStatus, setTestimonialOnDashboard } from '@/lib/actions';
import { testimonialsForAdmin, testimonialAudienceCount, hasActiveRequest } from '@/lib/testimonials';
import { ArrowLeft, ExternalLink } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Advertiser' };

export default async function VendorDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      campaigns: { orderBy: { createdAt: 'desc' }, take: 20 },
      reports: { orderBy: { createdAt: 'desc' }, take: 20 },
      _count: { select: { campaigns: true, reports: true, savedBy: true } },
    },
  });
  if (!vendor) notFound();

  const [testimonials, audience, requestOpen] = await Promise.all([
    testimonialsForAdmin(vendor.id),
    testimonialAudienceCount(vendor.id),
    hasActiveRequest(vendor.id),
  ]);

  const F = ({ label, name, defaultValue, placeholder, type = 'text' }: { label: string; name: string; defaultValue?: string | null; placeholder?: string; type?: string }) => (
    <label className="block">
      <span className="label !mb-1 text-xs">{label}</span>
      <input type={type} name={name} defaultValue={defaultValue ?? ''} placeholder={placeholder} className="input" />
    </label>
  );

  return (
    <div className="max-w-3xl">
      <Link href="/admin/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Vendors</Link>
      <h1 className="mb-1 text-2xl font-bold">{vendor.name}</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Advertiser profile. When <strong>Premium supplier</strong> is on, these fields populate the reader phone book, and ads gain an options menu that links out to the supplier page on our main site.</p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[['Campaigns', vendor._count.campaigns], ['Reports', vendor._count.reports], ['In phone books', vendor._count.savedBy]].map(([l, n]) => (
          <div key={l as string} className="tile p-3 text-center">
            <div className="text-2xl font-black">{n as number}</div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{l as string}</div>
          </div>
        ))}
      </div>

      <form action={saveVendorProfile} className="card space-y-4 p-5">
        <input type="hidden" name="id" value={vendor.id} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="premium" defaultChecked={vendor.premium} className="h-4 w-4" /> Premium supplier
          <span className="font-normal text-[var(--muted)]">— appears in the phone-book directory readers can save.</span>
        </label>
        <F label="Display name" name="name" defaultValue={vendor.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Website" name="website" defaultValue={vendor.website} placeholder="https://…" type="url" />
          <F label="Sales phone" name="phone" defaultValue={vendor.phone} placeholder="(555) 123-4567" />
        </div>
        <F label="Supplier page URL (on our main site)" name="supplierUrl" defaultValue={vendor.supplierUrl} placeholder="https://rsnews.com/suppliers/… — links out from ads & phone book" type="url" />
        <F label="Contact email (official)" name="contactEmail" defaultValue={vendor.contactEmail} placeholder="sales@vendor.com" type="email" />
        <label className="block">
          <span className="label !mb-1 text-xs">Blurb (phone book)</span>
          <textarea name="blurb" defaultValue={vendor.blurb ?? ''} rows={3} className="input" placeholder="A short description shown in the phone book." />
        </label>
        <F label="Logo URL" name="logoUrl" defaultValue={vendor.logoUrl} placeholder="https://… (optional)" />
        <label className="block">
          <span className="label !mb-1 text-xs">Private notes (admin only)</span>
          <textarea name="notes" defaultValue={vendor.notes ?? ''} rows={2} className="input" />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary btn-sm">Save profile</button>
          {vendor.premium && <Link href={`/docs/suppliers/${vendor.id}`} className="btn-outline btn-sm" target="_blank">Open in phone book <ExternalLink width={13} height={13} /></Link>}
        </div>
      </form>

      {vendor.reports.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-[var(--muted)]">Performance reports</h2>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-2)]">
            {vendor.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-semibold">{r.periodLabel}</span>
                <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span className={`badge ${r.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{r.status[0] + r.status.slice(1).toLowerCase()}</span>
                  {formatDate(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">Testimonials</h2>
          <div className="flex items-center gap-2">
            {testimonials.some((t) => t.showOnVendorDashboard) && (
              <Link href={`/vendor-testimonials?vendorId=${vendor.id}`} target="_blank" className="btn-outline btn-sm">Preview document <ExternalLink width={13} height={13} /></Link>
            )}
            {vendor.premium ? (
              <form action={requestSupplierTestimonials.bind(null, vendor.id)}>
                <button type="submit" className="btn-outline btn-sm" disabled={audience === 0}>
                  {requestOpen ? 'Re-send request' : 'Request testimonials'}{audience > 0 ? ` (${audience})` : ''}
                </button>
              </form>
            ) : (
              <span className="text-xs text-[var(--muted)]">Turn on Premium to collect testimonials.</span>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          {vendor.premium
            ? requestOpen
              ? `A request is open. ${audience} saver${audience === 1 ? '' : 's'} who haven't vouched yet are being nudged in their notifications.`
              : `Requesting nudges the ${audience} reader${audience === 1 ? '' : 's'} who have this supplier in their phone book and haven't left a testimonial yet. Approve the ones you like, then include them in the advertiser's downloadable document.`
            : 'Testimonials appear here once the supplier is premium and readers respond.'}
        </p>

        {testimonials.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">No testimonials yet.</p>
        ) : (
          <ul className="space-y-3">
            {testimonials.map((t) => (
              <li key={t.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <blockquote className="text-sm leading-relaxed">“{t.body}”</blockquote>
                    <div className="mt-1.5 text-xs text-[var(--muted)]">— {t.authorName} · {formatDate(t.createdAt)}</div>
                  </div>
                  <span className={`badge shrink-0 ${t.status === 'APPROVED' ? 'bg-green-100 text-green-700' : t.status === 'REJECTED' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-amber-100 text-amber-800'}`}>
                    {t.status[0] + t.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                  {t.status !== 'APPROVED' && (
                    <form action={setTestimonialStatus.bind(null, t.id, 'APPROVED')}><button className="btn-outline btn-sm text-green-700">Approve</button></form>
                  )}
                  {t.status !== 'REJECTED' && (
                    <form action={setTestimonialStatus.bind(null, t.id, 'REJECTED')}><button className="btn-outline btn-sm text-red-600">Reject</button></form>
                  )}
                  {t.status === 'APPROVED' && (
                    <form action={setTestimonialOnDashboard.bind(null, t.id, !t.showOnVendorDashboard)}>
                      <button className={`btn-sm ${t.showOnVendorDashboard ? 'btn-primary' : 'btn-outline'}`}>{t.showOnVendorDashboard ? '✓ In vendor document' : 'Add to vendor document'}</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
