// Integration tests for the supplier phone-book lifecycle — these hit the DB so
// they lock in behaviour a unit test can't: the "New" arrival badge clearing
// per-account on view, the 30-day leaving grace, the nightly soft-removal sweep
// (which RETAINS notes), and rejoin restoring a soft-removed entry. Rows are
// namespaced + cleaned up, so it's safe against a shared DB.

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import {
  newSuppliersFor, markSupplierSeen, expiringSavedSuppliersFor,
  sweepExpiredSavedSuppliers, reactivateSavedSuppliers, getPhoneBook, savedVendorIds,
  SUPPLIER_GRACE_DAYS,
} from './suppliers';

let seq = 0;
const tag = () => `sup-${Date.now().toString(36)}-${seq++}`;
const users: string[] = [];
const vendors: string[] = [];

async function mkUser() {
  const t = tag();
  const u = await prisma.user.create({ data: { email: `${t}@example.com`, name: `U ${t}` } });
  users.push(u.id);
  return u;
}
async function mkVendor(data: Record<string, unknown> = {}) {
  const t = tag();
  const v = await prisma.vendor.create({ data: { name: `V ${t}`, brandKey: `bk-${t}`, premium: true, ...data } });
  vendors.push(v.id);
  return v;
}

afterEach(async () => {
  if (vendors.length) {
    await prisma.savedSupplier.deleteMany({ where: { vendorId: { in: vendors } } });
    await prisma.supplierSeen.deleteMany({ where: { vendorId: { in: vendors } } });
    await prisma.vendor.deleteMany({ where: { id: { in: vendors } } });
    vendors.length = 0;
  }
  if (users.length) {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    users.length = 0;
  }
});

describe('supplier lifecycle — "New" arrival badge', () => {
  it('shows a newly-premium supplier to an account that predates it, until seen', async () => {
    const u = await mkUser();
    const v = await mkVendor({ premiumSince: new Date(u.createdAt.getTime() + 1000) });

    expect((await newSuppliersFor(u.id)).map((n) => n.vendorId)).toContain(v.id);
    await markSupplierSeen(u.id, v.id);
    expect((await newSuppliersFor(u.id)).map((n) => n.vendorId)).not.toContain(v.id);
  });

  it('never flags a supplier with no premiumSince (the pre-feature roster)', async () => {
    const u = await mkUser();
    const v = await mkVendor({ premiumSince: null });
    expect((await newSuppliersFor(u.id)).map((n) => n.vendorId)).not.toContain(v.id);
  });
});

describe('supplier lifecycle — leaving grace, sweep, rejoin', () => {
  it('warns within grace, soft-removes after grace (keeping notes), and restores on rejoin', async () => {
    const u = await mkUser();
    const v = await mkVendor();
    await prisma.savedSupplier.create({ data: { userId: u.id, vendorId: v.id, note: 'call Dana on Tuesdays' } });

    // Downgrade just now → within grace: shows as expiring + phone book leaving badge.
    await prisma.vendor.update({ where: { id: v.id }, data: { premium: false, premiumEndedAt: new Date() } });
    expect((await expiringSavedSuppliersFor(u.id)).map((e) => e.vendorId)).toContain(v.id);
    expect((await getPhoneBook(u.id)).find((b) => b.vendor.id === v.id)?.leavingOn).toBeTruthy();

    // A sweep now must NOT touch a within-grace entry.
    await sweepExpiredSavedSuppliers();
    expect((await getPhoneBook(u.id)).find((b) => b.vendor.id === v.id)).toBeTruthy();

    // Age the departure past the grace window → sweep soft-removes it.
    await prisma.vendor.update({ where: { id: v.id }, data: { premiumEndedAt: new Date(Date.now() - (SUPPLIER_GRACE_DAYS + 1) * 864e5) } });
    const swept = await sweepExpiredSavedSuppliers();
    expect(swept.removed).toBeGreaterThanOrEqual(1);
    expect((await getPhoneBook(u.id)).find((b) => b.vendor.id === v.id)).toBeUndefined();
    expect(await savedVendorIds(u.id)).not.toContain(v.id);

    // Soft — the row and its notes are retained, not deleted.
    const row = await prisma.savedSupplier.findUnique({ where: { userId_vendorId: { userId: u.id, vendorId: v.id } } });
    expect(row?.removedAt).toBeTruthy();
    expect(row?.note).toBe('call Dana on Tuesdays');

    // Rejoin (premium again) restores the entry with its notes intact.
    await prisma.vendor.update({ where: { id: v.id }, data: { premium: true, premiumSince: new Date(), premiumEndedAt: null } });
    await reactivateSavedSuppliers(v.id);
    const restored = (await getPhoneBook(u.id)).find((b) => b.vendor.id === v.id);
    expect(restored).toBeTruthy();
    expect(restored?.note).toBe('call Dana on Tuesdays');
    expect(restored?.leavingOn).toBeNull();
  });

  it('shows no "Leaving" badge once past grace (pre-sweep) or while still premium', async () => {
    const u = await mkUser();
    const v = await mkVendor();
    await prisma.savedSupplier.create({ data: { userId: u.id, vendorId: v.id } });

    // Past grace but not yet swept → still listed, but the badge is gone (it only
    // shows within the grace window, matching the expiry notification).
    await prisma.vendor.update({ where: { id: v.id }, data: { premium: false, premiumEndedAt: new Date(Date.now() - (SUPPLIER_GRACE_DAYS + 1) * 864e5) } });
    let entry = (await getPhoneBook(u.id)).find((b) => b.vendor.id === v.id);
    expect(entry).toBeTruthy();
    expect(entry?.leavingOn).toBeNull();

    // A still-premium vendor never renders as leaving, even with a stray timestamp.
    await prisma.vendor.update({ where: { id: v.id }, data: { premium: true, premiumEndedAt: new Date() } });
    entry = (await getPhoneBook(u.id)).find((b) => b.vendor.id === v.id);
    expect(entry?.leavingOn).toBeNull();
  });
});
