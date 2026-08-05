// Demo seed: ad impression/click events for PackWise across Q2 2026 (a completed
// quarter), so a performance report has real numbers. Also sets a known password
// on the seed admin for local preview. Dev only.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const creatives = [
  { id: 'pw-banner', placement: 'article-top', shape: 'banner' },
  { id: 'pw-rect', placement: 'article-bottom', shape: 'rectangle' },
];
const devices = ['desktop', 'mobile', 'tablet'];

// Deterministic pseudo-random so re-runs are stable (no Math.random needed).
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

async function main() {
  await prisma.user.updateMany({ where: { email: 'admin@rsnews.local' }, data: { passwordHash: await bcrypt.hash('admin1234', 10) } });

  // Clear any prior demo ad events for this brand window so re-runs are clean.
  const qStart = new Date('2026-04-01T00:00:00Z');
  const qEnd = new Date('2026-07-01T00:00:00Z');
  await prisma.analyticsEvent.deleteMany({ where: { subjectType: 'ad', createdAt: { gte: qStart, lt: qEnd }, props: { contains: '"campaignId":"PackWise"' } } });

  const rand = rng(42);
  const rows = [];
  const dayMs = 86_400_000;
  // ~85 days in the quarter; a few impressions/day/creative + occasional clicks.
  for (let day = 0; day < 85; day++) {
    const when = new Date(qStart.getTime() + day * dayMs + Math.floor(rand() * dayMs));
    for (const c of creatives) {
      const impressions = 2 + Math.floor(rand() * 4); // 2–5
      for (let i = 0; i < impressions; i++) {
        const viewable = rand() > 0.2;
        rows.push({
          type: 'impression', subjectType: 'ad', subjectId: c.id, placement: c.placement,
          pageType: 'article', device: devices[Math.floor(rand() * devices.length)],
          visitorId: `v${Math.floor(rand() * 400)}`, sessionId: `s${Math.floor(rand() * 800)}`,
          value: Math.floor(500 + rand() * 6000),
          props: JSON.stringify({ brand: 'PackWise', campaignId: 'PackWise', creativeId: c.id, shape: c.shape, format: 'image', viewable, aboveFold: rand() > 0.5, dwellMs: Math.floor(500 + rand() * 6000) }),
          createdAt: when,
        });
        if (viewable && rand() > 0.94) {
          rows.push({
            type: 'click', subjectType: 'ad', subjectId: c.id, placement: c.placement,
            pageType: 'article', device: 'desktop', visitorId: `v${Math.floor(rand() * 400)}`, sessionId: `s${Math.floor(rand() * 800)}`,
            props: JSON.stringify({ brand: 'PackWise', campaignId: 'PackWise', creativeId: c.id, shape: c.shape }),
            createdAt: new Date(when.getTime() + 1000),
          });
        }
      }
    }
  }
  await prisma.analyticsEvent.createMany({ data: rows });
  const imp = rows.filter((r) => r.type === 'impression').length;
  const clk = rows.filter((r) => r.type === 'click').length;
  console.log(`Seeded ${rows.length} PackWise ad events in Q2 2026 (${imp} impressions, ${clk} clicks). Admin password set to admin1234.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
