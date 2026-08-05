// The Vendor entity seam. Campaigns, ad accounts, and (later) performance
// reports all resolve to a single Vendor row rather than matching on a brand
// *string*. `brandKey` (trim+lowercase) is the match key — unique per vendor —
// so casing/whitespace can never split one advertiser into two.
//
// The pure helpers (brandKey, sameVendor) are DB-free and unit-tested; the two
// async helpers are thin upserts/lookups over that key.

import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { brandKey } from './entitlements';

export { brandKey };

// Either the base client or a transaction client — so callers can run these
// inside a `prisma.$transaction(...)` for atomicity (e.g. JotForm ingest).
type Db = Prisma.TransactionClient | typeof prisma;

/** Do two vendor names refer to the same advertiser? Case/whitespace-insensitive. */
export function sameVendor(a: unknown, b: unknown): boolean {
  const ka = brandKey(a);
  return ka !== '' && ka === brandKey(b);
}

/**
 * Find (or create) the Vendor for a display name, keyed on its normalized brand
 * key. Idempotent: the same name in any casing returns the same vendor, and the
 * first-seen display name is preserved (a later spelling won't clobber it).
 */
export async function findOrCreateVendor(name: string, db: Db = prisma, contactEmail?: string): Promise<string> {
  const key = brandKey(name);
  if (!key) throw new Error('A vendor name is required');
  const email = contactEmail?.trim() || undefined;
  const vendor = await db.vendor.upsert({
    where: { brandKey: key },
    update: {},
    create: { name: name.trim(), brandKey: key, contactEmail: email },
    select: { id: true, contactEmail: true },
  });
  // Backfill a contact email onto an existing vendor that doesn't have one yet
  // (e.g. first submission lacked it) — but never overwrite an existing address.
  if (email && !vendor.contactEmail) {
    await db.vendor.update({ where: { id: vendor.id }, data: { contactEmail: email } });
  }
  return vendor.id;
}

/** Resolve the Vendor id for a brand string (e.g. a logged-in vendor's brand), or null. */
export async function vendorIdForBrand(brand: unknown): Promise<string | null> {
  const key = brandKey(brand);
  if (!key) return null;
  const v = await prisma.vendor.findUnique({ where: { brandKey: key }, select: { id: true } });
  return v?.id ?? null;
}
