import { prisma } from './db';
import { loadAds } from './adsServer';
import { type AdRow } from './ads';
import { brandKey } from './entitlements';

// Server helpers for the supplier directory + phone book. The hub does NOT host
// public supplier pages — those live on the main site and we link out via
// `supplierUrl`. The phone book is an account-tied, private tool.

// How long a saved supplier lingers (with a "leaving" badge) in each member's
// phone book after the vendor loses premium status, before the nightly sweep
// soft-removes it. Warned first via the notifications feed so a member can copy
// their notes. Soft-remove = deactivate (retained + restored on rejoin), never
// destroy — see SavedSupplier.removedAt / reactivateSavedSuppliers.
export const SUPPLIER_GRACE_DAYS = 30;

export type SupplierLite = {
  id: string; name: string; brandKey: string; premium: boolean;
  website: string | null; supplierUrl: string | null; contactName: string | null;
  phone: string | null; contactEmail: string | null; blurb: string | null; logoUrl: string | null;
  premiumSince: Date | null; premiumEndedAt: Date | null;
};

const supplierSelect = {
  id: true, name: true, brandKey: true, premium: true,
  website: true, supplierUrl: true, contactName: true, phone: true, contactEmail: true, blurb: true, logoUrl: true,
  premiumSince: true, premiumEndedAt: true,
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
  // When this saved supplier will drop out of the phone book (vendor lost premium
  // → premiumEndedAt + grace). null unless the vendor is in its leaving window;
  // drives the "Leaving ‹date›" badge. Computed server-side so the client needs
  // no grace constant.
  leavingOn: Date | null;
};

/** A member's saved suppliers ("phone book"), with their notes + self-added
 *  alternative contacts. */
export async function getPhoneBook(userId: string): Promise<PhoneBookEntry[]> {
  const rows = await prisma.savedSupplier.findMany({
    where: { userId, removedAt: null }, // soft-removed (post-grace) entries stay hidden
    orderBy: { vendor: { name: 'asc' } },
    select: { note: true, altEmail: true, altPhone: true, vendor: { select: supplierSelect } },
  });
  const graceMs = SUPPLIER_GRACE_DAYS * 864e5;
  return rows.map((r) => ({
    vendor: r.vendor,
    note: r.note,
    altEmail: r.altEmail,
    altPhone: r.altPhone,
    leavingOn: r.vendor.premiumEndedAt ? new Date(r.vendor.premiumEndedAt.getTime() + graceMs) : null,
  }));
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

/** Vendor ids the member has saved (active only) — for star state in the directory. */
export async function savedVendorIds(userId: string): Promise<string[]> {
  const rows = await prisma.savedSupplier.findMany({ where: { userId, removedAt: null }, select: { vendorId: true } });
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

// ─────────────────────────── Supplier lifecycle ─────────────────────────────

/** Record that this account has opened a supplier's detail — clears the account's
 *  "New" arrival badge for that supplier. Idempotent. */
export async function markSupplierSeen(userId: string, vendorId: string): Promise<void> {
  await prisma.supplierSeen.upsert({
    where: { userId_vendorId: { userId, vendorId } },
    update: {},
    create: { userId, vendorId },
  });
}

/** Premium suppliers that are "new" to THIS account: they became premium after
 *  the account existed AND the account hasn't opened them yet. Newest first.
 *  (Suppliers premium before this feature shipped have a null premiumSince and
 *  never count as new — so the existing roster isn't flagged.) */
export async function newSuppliersFor(userId: string): Promise<{ vendorId: string; name: string; premiumSince: Date }[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return [];
  const [fresh, seen] = await Promise.all([
    prisma.vendor.findMany({
      where: { premium: true, premiumSince: { gt: user.createdAt } },
      select: { id: true, name: true, premiumSince: true },
      orderBy: { premiumSince: 'desc' },
    }),
    prisma.supplierSeen.findMany({ where: { userId }, select: { vendorId: true } }),
  ]);
  const seenSet = new Set(seen.map((s) => s.vendorId));
  return fresh
    .filter((v) => v.premiumSince && !seenSet.has(v.id))
    .map((v) => ({ vendorId: v.id, name: v.name, premiumSince: v.premiumSince! }));
}

/** Saved suppliers of THIS account that are inside the leaving grace window — the
 *  vendor lost premium but the entry hasn't been swept yet. Drives the "leaving"
 *  badge + the expiry notification. `removeOn` is when the sweep will hide it. */
export async function expiringSavedSuppliersFor(userId: string): Promise<{ vendorId: string; name: string; endedAt: Date; removeOn: Date }[]> {
  const graceMs = SUPPLIER_GRACE_DAYS * 864e5;
  const withinGrace = new Date(Date.now() - graceMs); // ended before this → already past grace
  const rows = await prisma.savedSupplier.findMany({
    where: { userId, removedAt: null, vendor: { premiumEndedAt: { not: null, gte: withinGrace } } },
    select: { vendor: { select: { id: true, name: true, premiumEndedAt: true } } },
  });
  return rows.map((r) => ({
    vendorId: r.vendor.id,
    name: r.vendor.name,
    endedAt: r.vendor.premiumEndedAt!,
    removeOn: new Date(r.vendor.premiumEndedAt!.getTime() + graceMs),
  }));
}

/** Nightly sweep: soft-remove saved entries whose vendor lost premium more than
 *  the grace period ago. Retained (removedAt set, notes kept) so a rejoin can
 *  restore them — never deleted. Returns how many were deactivated. */
export async function sweepExpiredSavedSuppliers(now = new Date()): Promise<{ removed: number }> {
  const cutoff = new Date(now.getTime() - SUPPLIER_GRACE_DAYS * 864e5);
  const res = await prisma.savedSupplier.updateMany({
    where: { removedAt: null, vendor: { premiumEndedAt: { not: null, lt: cutoff } } },
    data: { removedAt: now },
  });
  return { removed: res.count };
}

/** Restore a vendor's soft-removed saved entries when they rejoin as premium —
 *  the notes "come back". Called from saveVendorProfile on the false→true edge. */
export async function reactivateSavedSuppliers(vendorId: string): Promise<{ restored: number }> {
  const res = await prisma.savedSupplier.updateMany({
    where: { vendorId, removedAt: { not: null } },
    data: { removedAt: null },
  });
  return { restored: res.count };
}
