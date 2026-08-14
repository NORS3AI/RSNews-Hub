// Demo seed for the advertiser dashboard's NEW per-batch + sponsored-article
// tables. Creates a PackWise campaign with two real flights (batches), a
// sponsored article, and recent ad events carrying flightId / articleId /
// sponsored props so the "By campaign batch" and "Inside sponsored articles"
// sections populate with readable labels. Dev only.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const dayMs = 86_400_000;

// Deterministic PRNG (stable re-runs; no Math.random).
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

async function main() {
  const NOW = new Date('2026-08-14T12:00:00Z');
  await prisma.user.updateMany({ where: { email: 'admin@rsnews.local' }, data: { passwordHash: await bcrypt.hash('admin1234', 10), role: 'ADMIN' } });

  // Vendor + campaign.
  const vendor = await prisma.vendor.upsert({
    where: { brandKey: 'packwise' },
    update: { name: 'PackWise' },
    create: { name: 'PackWise', brandKey: 'packwise' },
  });
  const campaign = await prisma.adCampaign.create({
    data: { vendorName: 'PackWise', vendorId: vendor.id, plan: 'half', status: 'ACTIVE',
      startAt: new Date('2026-05-01T00:00:00Z'), endAt: new Date('2026-09-01T00:00:00Z') },
  });

  // Two batches (flights): batch 1 = May–Jul, batch 2 = Jul–Sep.
  const flights = [];
  for (const [index, startAt, endAt] of [
    [1, '2026-05-01T00:00:00Z', '2026-07-01T00:00:00Z'],
    [2, '2026-07-01T00:00:00Z', '2026-09-01T00:00:00Z'],
  ]) {
    const f = await prisma.adFlight.create({
      data: { campaignId: campaign.id, index, status: index === 2 ? 'SCHEDULED' : 'ENDED',
        startAt: new Date(startAt), endAt: new Date(endAt) },
    });
    // ~2 creatives per batch.
    const ads = [];
    for (let i = 1; i <= 2; i++) {
      const ad = await prisma.ad.create({
        data: { brand: 'PackWise', headline: `PackWise batch ${index} ad ${i}`, keywords: 'packwise',
          imageWide: '/uploads/demo/pw-wide.png', imageRect: '/uploads/demo/pw-rect.png',
          active: true, flightId: f.id },
      });
      ads.push({ id: ad.id, shape: i === 1 ? 'banner' : 'rectangle', placement: i === 1 ? 'article-top' : 'article-bottom' });
    }
    flights.push({ id: f.id, index, startAt: new Date(startAt), endAt: new Date(endAt), ads });
  }

  // A sponsored article connected to PackWise (drives the sponsored-article table).
  const article = await prisma.article.upsert({
    where: { slug: 'packwise-sponsored-demo' },
    update: { sponsorVendorId: vendor.id, status: 'PUBLISHED' },
    create: { title: 'How PackWise Streamlines the Counter', slug: 'packwise-sponsored-demo',
      content: '<p>Sponsored demo.</p>', status: 'PUBLISHED', publishedAt: new Date('2026-06-01T00:00:00Z'),
      sponsorVendorId: vendor.id },
  });

  // Clear prior demo events for this brand so re-runs are clean.
  await prisma.analyticsEvent.deleteMany({ where: { subjectType: 'ad', props: { contains: '"campaignId":"PackWise"' } } });

  const rand = rng(7);
  const devices = ['desktop', 'mobile', 'tablet'];
  const rows = [];
  // Seed events across the last ~80 days, attributed to whichever batch's window
  // the day falls in — so both batches (and the sponsored article) get numbers.
  for (let back = 80; back >= 1; back--) {
    const when = new Date(NOW.getTime() - back * dayMs + Math.floor(rand() * dayMs));
    const flight = flights.find((f) => when >= f.startAt && when < f.endAt);
    if (!flight) continue;
    // Every event this day runs inside the sponsored article.
    for (const c of flight.ads) {
      const impressions = 2 + Math.floor(rand() * 4);
      for (let i = 0; i < impressions; i++) {
        const viewable = rand() > 0.2;
        const props = { brand: 'PackWise', campaignId: 'PackWise', creativeId: c.id, shape: c.shape, format: 'image',
          flightId: flight.id, flightIndex: flight.index, articleId: article.id, articleSlug: article.slug, sponsored: true,
          viewable, aboveFold: rand() > 0.5, dwellMs: Math.floor(500 + rand() * 6000) };
        rows.push({ type: 'impression', subjectType: 'ad', subjectId: c.id, placement: c.placement, pageType: 'article',
          device: devices[Math.floor(rand() * devices.length)], visitorId: `v${Math.floor(rand() * 400)}`,
          sessionId: `s${Math.floor(rand() * 800)}`, value: props.dwellMs, props: JSON.stringify(props), createdAt: when });
        if (viewable && rand() > 0.9) {
          rows.push({ type: 'click', subjectType: 'ad', subjectId: c.id, placement: c.placement, pageType: 'article',
            device: 'desktop', visitorId: `v${Math.floor(rand() * 400)}`, sessionId: `s${Math.floor(rand() * 800)}`,
            props: JSON.stringify({ brand: 'PackWise', campaignId: 'PackWise', creativeId: c.id, shape: c.shape,
              flightId: flight.id, flightIndex: flight.index, articleId: article.id, sponsored: true }),
            createdAt: new Date(when.getTime() + 1000) });
        }
      }
    }
  }
  await prisma.analyticsEvent.createMany({ data: rows });
  const imp = rows.filter((r) => r.type === 'impression').length;
  const clk = rows.filter((r) => r.type === 'click').length;
  console.log(`Seeded ${rows.length} PackWise events (${imp} impr, ${clk} clicks) across 2 batches + 1 sponsored article. Admin: admin@rsnews.local / admin1234`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
