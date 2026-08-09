import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPremiumSupplierBySlug, getSupplierLiveAds, savedVendorIds } from '@/lib/suppliers';
import { testimonialsForSupplierPage, myTestimonial } from '@/lib/testimonials';
import SupplierSaveButton from '@/components/site/SupplierSaveButton';
import TestimonialForm from '@/components/site/TestimonialForm';
import InArticleAd from '@/components/InArticleAd';
import { ArrowLeft, LinkIcon, Mail } from '@/components/icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const s = await getPremiumSupplierBySlug(slug);
  return { title: s ? s.name : 'Supplier' };
}

export default async function SupplierPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supplier = await getPremiumSupplierBySlug(slug);
  if (!supplier) notFound();

  const user = await getCurrentUser();
  const [saved, liveAds, testimonials, mine] = await Promise.all([
    user ? savedVendorIds(user.id) : Promise.resolve([]),
    getSupplierLiveAds(supplier.brandKey),
    testimonialsForSupplierPage(supplier.id),
    user ? myTestimonial(user.id, supplier.id) : Promise.resolve(null),
  ]);
  const isSaved = saved.includes(supplier.id);

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/suppliers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
        <ArrowLeft width={16} height={16} /> Suppliers
      </Link>

      <div className="module">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {supplier.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={supplier.logoUrl} alt={supplier.name} className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card-2)] object-contain p-1.5" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-600/15 text-2xl font-black text-brand-600">{supplier.name.charAt(0)}</div>
            )}
            <div className="min-w-0">
              <div className="mb-1 inline-flex items-center gap-2">
                <span className="badge bg-brand-600/15 text-[10px] text-brand-600">Premium supplier</span>
              </div>
              <h1 className="text-2xl font-bold">{supplier.name}</h1>
              {supplier.blurb && <p className="mt-1 max-w-2xl text-[var(--muted)]">{supplier.blurb}</p>}
            </div>
          </div>
          <SupplierSaveButton vendorId={supplier.id} saved={isSaved} signedIn={!!user} />
        </div>

        {/* Official contact — clearly the supplier's own details. */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-sm">
          {supplier.phone && <span className="inline-flex items-center gap-1.5 text-[var(--fg)]">📞 {supplier.phone}</span>}
          {supplier.contactEmail && (
            <a href={`mailto:${supplier.contactEmail}`} className="inline-flex items-center gap-1.5 text-[var(--fg)] hover:text-brand-600">
              <Mail width={15} height={15} /> {supplier.contactEmail}
            </a>
          )}
          {supplier.website && (
            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--fg)] hover:text-brand-600">
              <LinkIcon width={15} height={15} /> Visit website
            </a>
          )}
          {!supplier.phone && !supplier.contactEmail && !supplier.website && (
            <span className="text-[var(--muted)]">No public contact details listed yet.</span>
          )}
        </div>
      </div>

      {liveAds.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-[var(--muted)]">Current campaigns</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {liveAds.map((ad) => (
              <InArticleAd key={ad.id} ad={ad} slot={`supplier-${supplier.brandKey}`} size="rectangle" fill />
            ))}
          </div>
        </div>
      )}

      {testimonials.length > 0 && (
        <div className="mt-6 module">
          <h2 className="mb-3 text-lg font-bold">What stores say</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.id} className="tile p-4">
                <blockquote className="text-sm leading-relaxed text-[var(--fg)]">“{t.body}”</blockquote>
                <figcaption className="mt-2 text-xs font-semibold text-[var(--muted)]">— {t.authorName}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <TestimonialForm
        vendorId={supplier.id}
        vendorName={supplier.name}
        signedIn={!!user}
        isSaver={isSaved}
        existing={mine ? { body: mine.body, status: mine.status } : null}
        highlighted={false}
      />
    </div>
  );
}
