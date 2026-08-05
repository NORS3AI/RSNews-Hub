// Demo: an unpaid campaign with a flight + an assigned creative, ready to
// schedule — so the "can't go live unpaid" gate can be exercised.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const day = 86_400_000;

const brand = 'PayTest Co';
const key = brand.toLowerCase();
await prisma.adCampaign.deleteMany({ where: { vendorName: brand } });
await prisma.vendor.deleteMany({ where: { brandKey: key } });
const vendor = await prisma.vendor.create({ data: { name: brand, brandKey: key } });
const now = Date.now();
const campaign = await prisma.adCampaign.create({
  data: {
    vendorName: brand, vendorId: vendor.id, plan: 'quarter', status: 'ACTIVE',
    startAt: new Date(now - day), endAt: new Date(now + 90 * day),
    flights: { create: [{ index: 1, startAt: new Date(now - day), endAt: new Date(now + 90 * day), status: 'REVIEW' }] },
  },
  include: { flights: true },
});
// One creative assigned to flight 1 (so only payment blocks scheduling).
await prisma.ad.create({ data: { brand, headline: `${brand} — submitted ad`, active: false, flightId: campaign.flights[0].id } });
console.log('Seeded unpaid campaign', campaign.id, '| flight', campaign.flights[0].id);
await prisma.$disconnect();
