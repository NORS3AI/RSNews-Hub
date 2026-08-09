import { prisma } from './db';
import { loadAds } from './adsServer';
import { adIsLive, type AdRow } from './ads';
import { brandKey } from './entitlements';

// Server helpers for the reader-facing supplier directory + phone book.

/** URL-safe slug for a supplier's public page. The brand key is lowercase but
 *  keeps spaces/punctuation, which don't belong in a path segment — so links use
 *  this hyphenated form and the page reverse-matches on it. */
export function supplierSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export type SupplierLite = {
  id: string; name: string; brandKey: string; slug: string; premium: boolean;
  website: string | null; phone: string | null; contactEmail: string | null;
  blurb: string | null; logoUrl: string | null;
};

const supplierSelect = {
  id: true, name: true, brandKey: true, premium: true,
  website: true, phone: true, contactEmail: true, blurb: true, logoUrl: true,
} as const;

type SupplierRow = { id: string; name: string; brandKey: string; premium: boolean; website: string | null; phone: string | null; contactEmail: string | null; blurb: string | null; logoUrl: string | null };
const toLite = (v: SupplierRow): SupplierLite => ({ ...v, slug: supplierSlug(v.brandKey) });

/** All premium suppliers, for the public directory. */
export async function listPremiumSuppliers(): Promise<SupplierLite[]> {
  const rows = await prisma.vendor.findMany({ where: { premium: true }, orderBy: { name: 'asc' }, select: supplierSelect });
  return rows.map(toLite);
}

/** A premium supplier by its URL slug, for its public profile page. Non-premium
 *  vendors have no public page (returns null). Slugs are matched against the
 *  premium set (small), so a brand key with spaces resolves cleanly. */
export async function getPremiumSupplierBySlug(slug: string): Promise<SupplierLite | null> {
  const target = supplierSlug(slug);
  const rows = await prisma.vendor.findMany({ where: { premium: true }, select: supplierSelect });
  const match = rows.find((v) => supplierSlug(v.brandKey) === target);
  return match ? toLite(match) : null;
}

export type PhoneBookEntry = {
  vendor: SupplierLite;
  note: string | null;
  altEmail: string | null;
  altPhone: string | null;
};

/** A member's saved suppliers ("phone book"), with their notes + self-added
 *  alternative contacts. */
export async function getPhoneBook(userId: string): Promise<PhoneBookEntry[]> {
  const rows = await prisma.savedSupplier.findMany({
    where: { userId },
    orderBy: { vendor: { name: 'asc' } },
    select: { note: true, altEmail: true, altPhone: true, vendor: { select: supplierSelect } },
  });
  return rows.map((r) => ({ vendor: toLite(r.vendor), note: r.note, altEmail: r.altEmail, altPhone: r.altPhone }));
}

/** Vendor ids the member has saved — for star state in the directory. */
export async function savedVendorIds(userId: string): Promise<string[]> {
  const rows = await prisma.savedSupplier.findMany({ where: { userId }, select: { vendorId: true } });
  return rows.map((r) => r.vendorId);
}

/** A supplier's currently-live ad creatives, matched on brand key. Powers the
 *  "Current campaigns" strip on their public profile page. */
export async function getSupplierLiveAds(supplierBrandKey: string): Promise<AdRow[]> {
  const now = new Date();
  const ads = await loadAds();
  return ads.filter((a) => brandKey(a.brand) === supplierBrandKey && adIsLive(a, now));
}

export type SupplierAdInfo = { vendorId: string; brandKey: string; slug: string; premium: boolean; website: string | null };

/** brandKey → supplier info, so an ad creative can offer its "options" menu
 *  (supplier page · website · save to phone book) only when its brand is a
 *  premium supplier. Built once per page and shared across every ad slot. */
export async function getSupplierAdMap(): Promise<Map<string, SupplierAdInfo>> {
  const rows = await prisma.vendor.findMany({
    where: { premium: true },
    select: { id: true, brandKey: true, premium: true, website: true },
  });
  const m = new Map<string, SupplierAdInfo>();
  for (const r of rows) m.set(r.brandKey, { vendorId: r.id, brandKey: r.brandKey, slug: supplierSlug(r.brandKey), premium: r.premium, website: r.website });
  return m;
}
