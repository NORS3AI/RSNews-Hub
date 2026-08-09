import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { saveVendorProfile } from '@/lib/actions';
import { supplierSlug } from '@/lib/suppliers';
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
      <p className="mb-5 text-sm text-[var(--muted)]">Advertiser profile. Fields marked below appear on the reader-facing supplier page &amp; phone book (when <strong>Premium supplier</strong> is on).</p>

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
          <span className="font-normal text-[var(--muted)]">— shows a public supplier page &amp; appears in the directory.</span>
        </label>
        <F label="Display name" name="name" defaultValue={vendor.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Website" name="website" defaultValue={vendor.website} placeholder="https://…" type="url" />
          <F label="Sales phone" name="phone" defaultValue={vendor.phone} placeholder="(555) 123-4567" />
        </div>
        <F label="Contact email (official)" name="contactEmail" defaultValue={vendor.contactEmail} placeholder="sales@vendor.com" type="email" />
        <label className="block">
          <span className="label !mb-1 text-xs">Blurb (supplier page)</span>
          <textarea name="blurb" defaultValue={vendor.blurb ?? ''} rows={3} className="input" placeholder="A short description shown on their supplier page." />
        </label>
        <F label="Logo URL" name="logoUrl" defaultValue={vendor.logoUrl} placeholder="https://… (optional)" />
        <label className="block">
          <span className="label !mb-1 text-xs">Private notes (admin only)</span>
          <textarea name="notes" defaultValue={vendor.notes ?? ''} rows={2} className="input" />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary btn-sm">Save profile</button>
          {vendor.premium && <Link href={`/docs/supplier/${supplierSlug(vendor.brandKey)}`} className="btn-outline btn-sm" target="_blank">View supplier page <ExternalLink width={13} height={13} /></Link>}
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
    </div>
  );
}
