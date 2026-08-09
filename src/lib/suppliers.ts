import { prisma } from './db';
import { loadAds } from './adsServer';
import { type AdRow } from './ads';
import { brandKey } from './entitlements';

// Server helpers for the supplier directory + phone book. The hub does NOT host
// public supplier pages — those live on the main site and we link out via
// `supplierUrl`. The phone book is an account-tied, private tool.

export type SupplierLite = {
  id: string; name: string; brandKey: string; premium: boolean;
  website: string | null; supplierUrl: string | null; phone: string | null;
  contactEmail: string | null; blurb: string | null; logoUrl: string | null;
};

const supplierSelect = {
  id: true, name: true, brandKey: true, premium: true,
  website: true, supplierUrl: true, phone: true, contactEmail: true, blurb: true, logoUrl: true,
} as const;

/** All premium suppliers, for the phone-book directory. */
export async function listPremiumSuppliers(): Promise<SupplierLite[]> {
  return prisma.vendor.findMany({ where: { premium: true }, orderBy: { name: 'asc' }, select: supplierSelect });
}

/** A premium supplier by id, for its phone-book detail page (null if missing or
 *  not premium — non-premium vendors aren't browsable in the phone book). */
export async function getPremiumSupplier(vendorId: string): Promise<SupplierLite | null> {
  const v = await prisma.vendor.findUnique({ where: { id: vendorId }, select: supplierSelect });
  return v && v.premium ? v : null;
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
  return rows.map((r) => ({ vendor: r.vendor, note: r.note, altEmail: r.altEmail, altPhone: r.altPhone }));
}

/** One phone-book entry (the reader's saved row for a supplier), or null. */
export async function getSavedSupplier(userId: string, vendorId: string) {
  return prisma.savedSupplier.findUnique({
    where: { userId_vendorId: { userId, vendorId } },
    select: { note: true, altEmail: true, altPhone: true },
  });
}

/** The reader's private sticky notes for a supplier, newest first. */
export async function getSupplierStickyNotes(userId: string, vendorId: string) {
  return prisma.supplierNote.findMany({
    where: { userId, vendorId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, body: true, createdAt: true },
  });
}

/** Vendor ids the member has saved — for star state in the directory. */
export async function savedVendorIds(userId: string): Promise<string[]> {
  const rows = await prisma.savedSupplier.findMany({ where: { userId }, select: { vendorId: true } });
  return rows.map((r) => r.vendorId);
}

/** Every ad creative on file for a supplier (matched on brand key), for the
 *  "their ads" strip in the phone-book detail. Each links to its own href. */
export async function getSupplierAdsOnFile(supplierBrandKey: string): Promise<AdRow[]> {
  const ads = await loadAds();
  return ads.filter((a) => brandKey(a.brand) === supplierBrandKey);
}

export type SupplierAdInfo = { vendorId: string; brandKey: string; premium: boolean; website: string | null; supplierUrl: string | null };

/** brandKey → supplier info, so an ad creative can offer its "options" menu
 *  (supplier page · website · save to phone book) only when its brand is a
 *  premium supplier. Built once per page and shared across every ad slot. */
export async function getSupplierAdMap(): Promise<Map<string, SupplierAdInfo>> {
  const rows = await prisma.vendor.findMany({
    where: { premium: true },
    select: { id: true, brandKey: true, premium: true, website: true, supplierUrl: true },
  });
  const m = new Map<string, SupplierAdInfo>();
  for (const r of rows) m.set(r.brandKey, { vendorId: r.id, brandKey: r.brandKey, premium: r.premium, website: r.website, supplierUrl: r.supplierUrl });
  return m;
}
