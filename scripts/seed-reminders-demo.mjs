// Demo: two vendors with a fresh-ads-due flight and a renewal-due campaign — one
// WITH a contact email (should be reminded), one WITHOUT (should be skipped).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const day = 86_400_000;

async function make(brand, email) {
  const key = brand.trim().toLowerCase();
  await prisma.adCampaign.deleteMany({ where: { vendorName: brand } });
  await prisma.vendor.deleteMany({ where: { brandKey: key } });
  const vendor = await prisma.vendor.create({ data: { name: brand, brandKey: key, contactEmail: email } });
  const now = Date.now();
  // Active campaign ending in ~20 days (renewal due within 30d), flight 2 starts
  // in ~10 days and still AWAITING (fresh-ads due within 21d).
  await prisma.adCampaign.create({
    data: {
      vendorName: brand, vendorId: vendor.id, plan: 'half', status: 'ACTIVE',
      startAt: new Date(now - 70 * day), endAt: new Date(now + 20 * day),
      flights: { create: [
        { index: 1, startAt: new Date(now - 70 * day), endAt: new Date(now + 10 * day), status: 'SCHEDULED' },
        { index: 2, startAt: new Date(now + 10 * day), endAt: new Date(now + 100 * day), status: 'AWAITING' },
      ] },
    },
  });
}

await make('MailVendor', 'ads@mailvendor.test');
await make('NoMail', null);
console.log('Seeded MailVendor (has email) + NoMail (no email), each with a fresh-ads-due flight + renewal-due campaign.');
await prisma.$disconnect();
