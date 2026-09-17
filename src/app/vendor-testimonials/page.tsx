import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { entitlementsOf } from '@/lib/entitlements';
import { vendorIdForBrand, isActiveVendor } from '@/lib/vendors';
import { testimonialsForVendorDashboard } from '@/lib/testimonials';
import { SITE_NAME } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import PrintButton from '@/components/site/PrintButton';
import TestimonialAttribution from '@/components/site/TestimonialAttribution';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Testimonials' };

// Standalone, print-optimized testimonial document (no app shell). Served to the
// advertiser (their own brand) and to staff previewing any vendor via ?vendorId.
export default async function VendorTestimonialsDoc(props: { searchParams: Promise<{ vendorId?: string }> }) {
  const { vendorId: qVendorId } = await props.searchParams;
  const user = await getCurrentUser();

  const wrap = (children: React.ReactNode) => (
    <main className="mx-auto max-w-2xl px-6 py-10 text-[var(--fg)]">{children}</main>
  );

  if (!user) {
    return wrap(<div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <p className="font-semibold">Sign in to view this document.</p>
      <Link href="/login" className="btn-primary btn-sm mt-3">Sign in</Link>
    </div>);
  }

  const isStaff = user.role === 'ADMIN' || user.role === 'EDITOR';
  // Non-staff access is coupled to premium supplier status, same as the vendor
  // dashboard — a de-listed vendor can't reach their testimonials doc either.
  // Staff can still preview any vendor via ?vendorId.
  if (!isStaff && !(await isActiveVendor(user))) {
    return wrap(<p className="text-[var(--muted)]">This document is available to active premium suppliers only.</p>);
  }
  const vendorId = qVendorId && isStaff ? qVendorId : await vendorIdForBrand(entitlementsOf(user).vendorBrand);
  if (!vendorId) {
    return wrap(<p className="text-[var(--muted)]">No advertiser record is linked to this account.</p>);
  }

  const [vendor, items] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true } }),
    testimonialsForVendorDashboard(vendorId),
  ]);
  if (!vendor) return wrap(<p className="text-[var(--muted)]">Advertiser not found.</p>);

  return wrap(
    <>
      {/* Print rules: hide the toolbar, give the sheet clean margins. */}
      <style>{`@media print { [data-noprint]{display:none!important} @page{margin:18mm} body{background:#fff} }`}</style>

      <div data-noprint className="mb-6 flex items-center justify-between gap-3">
        <Link href="/docs/vendor" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">← Back to dashboard</Link>
        {items.length > 0 && <PrintButton />}
      </div>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow-card)] print:border-0 print:shadow-none">
        <header className="mb-6 border-b-2 border-brand-600 pb-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">Customer testimonials</div>
          <h1 className="mt-1 text-3xl font-black leading-tight">{vendor.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Collected from verified {SITE_NAME} readers · {formatDate(new Date())}</p>
        </header>

        {items.length === 0 ? (
          <p className="text-[var(--muted)]">No testimonials have been added to this document yet.</p>
        ) : (
          <div className="space-y-6">
            {items.map((t) => (
              <figure key={t.id} className="break-inside-avoid">
                <blockquote className="border-l-4 border-brand-300 pl-4 text-lg italic leading-relaxed">“{t.body}”</blockquote>
                <figcaption className="mt-2 pl-4 text-sm font-semibold text-[var(--muted)]">
                  — <TestimonialAttribution storeName={t.storeName} authorName={t.authorName} />
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <footer className="mt-8 border-t border-[var(--border)] pt-4 text-center text-[11px] text-[var(--muted)]">
          Compiled by {SITE_NAME}. Testimonials are the words of independent {SITE_NAME} readers.
        </footer>
      </article>
    </>
  );
}
