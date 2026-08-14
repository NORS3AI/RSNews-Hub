// Demo seed for the schedule calendar's spanning bars: a running poll, running
// quiz, a running sponsored article, a scheduled (future) campaign, and a past
// poll — so the calendar shows running/scheduled/past bar states. Dev only.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const vendor = await prisma.vendor.upsert({ where: { brandKey: 'packwise' }, update: {}, create: { name: 'PackWise', brandKey: 'packwise' } });

  // Running module poll (Aug 10 → Aug 22).
  await prisma.poll.create({ data: { question: 'Best label printer?', kind: 'module', active: true, createdAt: new Date('2026-08-10T09:00:00Z'), closesAt: new Date('2026-08-22T09:00:00Z'), options: { create: [{ label: 'Zebra', order: 0 }, { label: 'Dymo', order: 1 }] } } });
  // Past poll (Jul 20 → Jul 30).
  await prisma.poll.create({ data: { question: 'Peak season staffing?', kind: 'module', active: false, createdAt: new Date('2026-07-20T09:00:00Z'), closesAt: new Date('2026-07-30T09:00:00Z'), options: { create: [{ label: 'Yes', order: 0 }, { label: 'No', order: 1 }] } } });

  // Running quiz (Aug 12 → Aug 18).
  await prisma.quiz.create({ data: { title: 'Shipping safety quiz', active: true, createdAt: new Date('2026-08-12T09:00:00Z'), closesAt: new Date('2026-08-18T09:00:00Z') } });

  // Running sponsored article (Aug 5 → Aug 28).
  await prisma.article.upsert({
    where: { slug: 'packwise-calendar-demo' },
    update: { genre: 'sponsored', sponsorVendorId: vendor.id, status: 'PUBLISHED', publishedAt: new Date('2026-08-05T00:00:00Z'), sponsoredUntil: new Date('2026-08-28T00:00:00Z') },
    create: { title: 'PackWise Cuts Counter Wait Times', slug: 'packwise-calendar-demo', content: '<p>x</p>', status: 'PUBLISHED', genre: 'sponsored', sponsorVendorId: vendor.id, publishedAt: new Date('2026-08-05T00:00:00Z'), sponsoredUntil: new Date('2026-08-28T00:00:00Z') },
  });

  // Scheduled (future) campaign (Aug 25 → Sep 20).
  const existing = await prisma.adCampaign.findFirst({ where: { vendorName: 'Acme Mailers' } });
  if (!existing) await prisma.adCampaign.create({ data: { vendorName: 'Acme Mailers', vendorId: vendor.id, plan: 'quarter', status: 'ACTIVE', startAt: new Date('2026-08-25T00:00:00Z'), endAt: new Date('2026-09-20T00:00:00Z') } });

  console.log('Seeded calendar demo: running poll+quiz+sponsored, scheduled campaign, past poll.');
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
