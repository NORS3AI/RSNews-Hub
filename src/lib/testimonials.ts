import { prisma } from './db';

// Server helpers for supplier testimonials: the admin request, the reader's
// submission, and the read surfaces (admin review + vendor dashboard document).
// Server actions that mutate live in lib/actions.

export type TestimonialLite = {
  id: string; authorName: string; storeName: string | null; body: string; createdAt: Date;
};

/** Approved testimonials an admin pushed to the advertiser's own dashboard. */
export async function testimonialsForVendorDashboard(vendorId: string): Promise<TestimonialLite[]> {
  const rows = await prisma.testimonial.findMany({
    where: { vendorId, status: 'APPROVED', showOnVendorDashboard: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, authorName: true, storeName: true, body: true, createdAt: true },
  });
  return rows;
}

/** Full list for the admin advertiser page (every status), newest first. */
export async function testimonialsForAdmin(vendorId: string) {
  return prisma.testimonial.findMany({
    where: { vendorId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, authorName: true, storeName: true, memberCode: true, body: true, status: true,
      showOnVendorDashboard: true, createdAt: true,
    },
  });
}

/** This reader's own testimonial for a supplier, if any (to show status / prefill). */
export async function myTestimonial(userId: string, vendorId: string) {
  return prisma.testimonial.findUnique({
    where: { userId_vendorId: { userId, vendorId } },
    select: { id: true, body: true, status: true },
  });
}

/** Is there an open request for this supplier right now? (Emphasizes the form.) */
export async function hasActiveRequest(vendorId: string): Promise<boolean> {
  const r = await prisma.testimonialRequest.findFirst({ where: { vendorId, active: true }, select: { id: true } });
  return !!r;
}

/** How many savers would a "request testimonials" nudge reach — everyone who has
 *  this supplier starred but hasn't submitted a testimonial yet. */
export async function testimonialAudienceCount(vendorId: string): Promise<number> {
  const [savers, submitters] = await Promise.all([
    prisma.savedSupplier.findMany({ where: { vendorId }, select: { userId: true } }),
    prisma.testimonial.findMany({ where: { vendorId }, select: { userId: true } }),
  ]);
  const done = new Set(submitters.map((s) => s.userId));
  return savers.filter((s) => !done.has(s.userId)).length;
}

export type TestimonialNudge = { vendorId: string; vendorName: string; createdAt: Date };

/** Testimonial nudges for a reader's notifications feed: active requests on
 *  suppliers they've starred and haven't yet vouched for. Derived (no stored
 *  per-user rows) — it clears itself the moment they submit. */
export async function testimonialNudges(userId: string): Promise<TestimonialNudge[]> {
  const requests = await prisma.testimonialRequest.findMany({
    where: { active: true },
    select: { vendorId: true, createdAt: true, vendor: { select: { name: true, premium: true } } },
  });
  if (!requests.length) return [];
  const vendorIds = requests.map((r) => r.vendorId);
  const [saved, mine] = await Promise.all([
    prisma.savedSupplier.findMany({ where: { userId, vendorId: { in: vendorIds } }, select: { vendorId: true } }),
    prisma.testimonial.findMany({ where: { userId, vendorId: { in: vendorIds } }, select: { vendorId: true } }),
  ]);
  const savedSet = new Set(saved.map((s) => s.vendorId));
  const doneSet = new Set(mine.map((m) => m.vendorId));
  const seen = new Set<string>();
  return requests
    .filter((r) => r.vendor.premium && savedSet.has(r.vendorId) && !doneSet.has(r.vendorId))
    // One nudge per vendor even if (via a race) two active requests exist.
    .filter((r) => (seen.has(r.vendorId) ? false : (seen.add(r.vendorId), true)))
    .map((r) => ({ vendorId: r.vendorId, vendorName: r.vendor.name, createdAt: r.createdAt }));
}
