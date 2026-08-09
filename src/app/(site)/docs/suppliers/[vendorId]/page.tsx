import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getPremiumSupplier, getSavedSupplier, getSupplierStickyNotes, getSupplierAdsOnFile,
} from '@/lib/suppliers';
import { myTestimonial } from '@/lib/testimonials';
import SupplierTools from '@/components/site/SupplierTools';
import TestimonialCta from '@/components/site/TestimonialCta';
import InArticleAd from '@/components/InArticleAd';
import { ArrowLeft, LinkIcon, Mail, Newspaper, Users } from '@/components/icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await props.params;
  const s = await getPremiumSupplier(vendorId);
  return { title: s ? s.name : 'Supplier' };
}

export default async function SupplierDetailPage(props: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await props.params;
  const supplier = await getPremiumSupplier(vendorId);
  if (!supplier) notFound();

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container-page py-8 sm:py-10">
        <div className="module max-w-lg">
          <h1 className="mb-2 text-xl font-bold">{supplier.name}</h1>
          <p className="text-sm text-[var(--muted)]">Sign in to keep this supplier in your Phone Book — with your own notes, an alternate contact, and quick links to their current ads.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/login" className="btn-primary btn-sm">Sign in</Link>
            <Link href="/register" className="btn-outline btn-sm">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  const [contact, sticky, mine, ads] = await Promise.all([
    getSavedSupplier(user.id, vendorId),
    getSupplierStickyNotes(user.id, vendorId),
    myTestimonial(user.id, vendorId),
    getSupplierAdsOnFile(supplier.brandKey),
  ]);
  const isSaved = !!contact; // getSavedSupplier returns the row only when saved

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/suppliers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
        <ArrowLeft width={16} height={16} /> Phone Book
      </Link>

      <div className="module">
        <div className="flex min-w-0 items-start gap-4">
          {supplier.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={supplier.logoUrl} alt={supplier.name} className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card-2)] object-contain p-1.5" />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-600/15 text-2xl font-black text-brand-600">{supplier.name.charAt(0)}</div>
          )}
          <div className="min-w-0">
            <span className="badge bg-brand-600/15 text-[10px] text-brand-600">Premium supplier</span>
            <h1 className="mt-1 text-2xl font-bold">{supplier.name}</h1>
            {supplier.blurb && <p className="mt-1 max-w-2xl text-[var(--muted)]">{supplier.blurb}</p>}
          </div>
        </div>

        {/* Official contact — the supplier's own details. */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-sm">
          {supplier.contactName && <span className="inline-flex items-center gap-1.5 text-[var(--fg)]"><Users width={15} height={15} /> {supplier.contactName}</span>}
          {supplier.phone && <span className="inline-flex items-center gap-1.5 text-[var(--fg)]">📞 {supplier.phone}</span>}
          {supplier.contactEmail && (
            <a href={`mailto:${supplier.contactEmail}`} className="inline-flex items-center gap-1.5 text-[var(--fg)] hover:text-brand-600"><Mail width={15} height={15} /> {supplier.contactEmail}</a>
          )}
          {supplier.website && (
            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--fg)] hover:text-brand-600"><LinkIcon width={15} height={15} /> Website</a>
          )}
          {supplier.supplierUrl && (
            <a href={supplier.supplierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--fg)] hover:text-brand-600"><Newspaper width={15} height={15} /> Supplier page</a>
          )}
        </div>

        <SupplierTools
          vendorId={supplier.id}
          vendorName={supplier.name}
          saved={isSaved}
          contact={contact}
          sticky={sticky}
        />

        {/* Testimonial CTA lives at the bottom of the main card, under the sticky notes. */}
        <TestimonialCta
          vendorId={supplier.id}
          vendorName={supplier.name}
          canSubmit={isSaved}
          existing={mine ? { status: mine.status } : null}
        />
      </div>

      {ads.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ads.map((ad) => (
            <InArticleAd key={ad.id} ad={ad} slot={`phonebook-${supplier.brandKey}`} size="rectangle" fill />
          ))}
        </div>
      )}
    </div>
  );
}
