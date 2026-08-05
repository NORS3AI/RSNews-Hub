// Backfill: give every existing AdCampaign a Vendor (by normalized brand key)
// and set campaign.vendorId. Idempotent — safe to run repeatedly. Run once after
// deploying the Vendor model (dev: `node scripts/backfill-vendors.mjs`).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const brandKey = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

async function main() {
  const campaigns = await prisma.adCampaign.findMany({ select: { id: true, vendorName: true, vendorId: true } });
  let created = 0, linked = 0, skipped = 0;

  for (const c of campaigns) {
    if (c.vendorId) { skipped++; continue; }
    const key = brandKey(c.vendorName);
    if (!key) { skipped++; continue; }
    const before = await prisma.vendor.findUnique({ where: { brandKey: key }, select: { id: true } });
    const vendor = await prisma.vendor.upsert({
      where: { brandKey: key },
      update: {},
      create: { name: c.vendorName.trim(), brandKey: key },
      select: { id: true },
    });
    if (!before) created++;
    await prisma.adCampaign.update({ where: { id: c.id }, data: { vendorId: vendor.id } });
    linked++;
  }

  console.log(`Backfill complete: ${linked} campaign(s) linked, ${created} vendor(s) created, ${skipped} already linked/blank.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
