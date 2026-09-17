// Integration test for isActiveVendor — vendor-dashboard access is coupled to
// the admin "Premium supplier" switch. Hits the DB (Vendor.premium lookup).

import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';
import { isActiveVendor } from './vendors';

let seq = 0;
const tag = () => `av-${Date.now().toString(36)}-${seq++}`;
const vendors: string[] = [];
async function mkVendor(premium: boolean) {
  const t = tag();
  const v = await prisma.vendor.create({ data: { name: `V ${t}`, brandKey: `av-${t}`, premium } });
  vendors.push(v.id);
  return v;
}
afterEach(async () => {
  if (vendors.length) { await prisma.vendor.deleteMany({ where: { id: { in: vendors } } }); vendors.length = 0; }
});

describe('isActiveVendor — dashboard access coupled to premium supplier status', () => {
  it('true for a vendor account whose brand is an active premium supplier', async () => {
    const v = await mkVendor(true);
    expect(await isActiveVendor({ accountType: 'VENDOR', vendorBrand: v.brandKey })).toBe(true);
  });

  it('false once that supplier loses premium (dashboard closes with the phone book)', async () => {
    const v = await mkVendor(false);
    expect(await isActiveVendor({ accountType: 'VENDOR', vendorBrand: v.brandKey })).toBe(false);
  });

  it('false for a non-vendor account or a signed-out viewer', async () => {
    await mkVendor(true);
    expect(await isActiveVendor({ accountType: 'MEMBER', vendorBrand: '' })).toBe(false);
    expect(await isActiveVendor(null)).toBe(false);
  });

  it('false for a vendor brand with no Vendor record at all', async () => {
    expect(await isActiveVendor({ accountType: 'VENDOR', vendorBrand: 'no-such-brand-xyz-123' })).toBe(false);
  });
});
