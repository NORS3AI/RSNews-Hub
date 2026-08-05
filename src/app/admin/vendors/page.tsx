import Link from 'next/link';
import { prisma } from '@/lib/db';
import { saveVendorContact } from '@/lib/actions';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminVendors() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { campaigns: true, reports: true } } },
  });
  const missingEmail = vendors.filter((v) => !v.contactEmail).length;

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Vendors</h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        Every advertiser is one vendor record — campaigns and performance reports hang off it. The <strong>contact email</strong> is where flight (&ldquo;fresh ads needed&rdquo;) and renewal reminders are sent; JotForm fills it when a submission includes an email, or set it here.
      </p>

      {missingEmail > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <strong>{missingEmail} vendor{missingEmail === 1 ? '' : 's'}</strong> {missingEmail === 1 ? 'has' : 'have'} no contact email — reminder emails can&apos;t reach {missingEmail === 1 ? 'it' : 'them'} until one is set below.
        </div>
      )}

      {vendors.length === 0 ? (
        <p className="text-[var(--muted)]">No vendors yet. They&apos;re created when a campaign is made or a JotForm submission arrives.</p>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <div key={v.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">{v.name}</div>
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
    </div>
  );
}
