// Demo seed: a vendor account (PackWise) with one live annual campaign and one
// completed past campaign, so /docs/vendor has something to show for a screenshot.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
function generateFlights(startAt, endAt, flightMonths = 3) {
  const flights = [];
  let cursor = new Date(startAt.getTime());
  let index = 1;
  while (cursor < endAt && index <= 24) {
    const next = addMonths(cursor, flightMonths);
    const flightEnd = next < endAt ? next : endAt;
    flights.push({ index, startAt: new Date(cursor.getTime()), endAt: flightEnd });
    cursor = flightEnd;
    index++;
  }
  return flights;
}

const now = new Date();
const BRAND = 'PackWise';

async function main() {
  // The vendor account. In production these facets arrive on the SSO token; in
  // local mode they live on the mirror User row (getCurrentUser selects them).
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const email = 'vendor@packwise.demo';
  const user = await prisma.user.upsert({
    where: { email },
    update: { accountType: 'VENDOR', vendorBrand: BRAND, status: 'ACTIVE' },
    create: {
      email, name: 'PackWise (advertiser)', passwordHash, role: 'USER', status: 'ACTIVE',
      accountType: 'VENDOR', vendorBrand: BRAND,
    },
  });

  // Clear any prior demo campaigns for this brand so re-runs are clean.
  await prisma.adCampaign.deleteMany({ where: { vendorName: BRAND } });

  // 1) LIVE annual campaign: started ~2 months ago → 4 quarterly flights.
  //    Flight 1 is live now; flight 2 is upcoming and still needs fresh ads.
  const aStart = addMonths(now, -2);
  const aEnd = addMonths(aStart, 12);
  const aFlights = generateFlights(aStart, aEnd, 3);
  const annual = await prisma.adCampaign.create({
    data: {
      vendorName: BRAND, plan: 'annual', startAt: aStart, endAt: aEnd,
      allowsVideo: false, status: 'ACTIVE',
      flights: { create: aFlights.map((f) => ({ index: f.index, startAt: f.startAt, endAt: f.endAt })) },
    },
    include: { flights: { orderBy: { index: 'asc' } } },
  });
  // Flight 1 live (SCHEDULED); flight 2 left AWAITING → "Fresh ads needed".
  await prisma.adFlight.update({ where: { id: annual.flights[0].id }, data: { status: 'SCHEDULED' } });

  // 2) COMPLETED past campaign (a 3-month run last year) → History tab.
  const bStart = addMonths(now, -8);
  const bEnd = addMonths(bStart, 3);
  const bFlights = generateFlights(bStart, bEnd, 3);
  await prisma.adCampaign.create({
    data: {
      vendorName: BRAND, plan: 'quarter', startAt: bStart, endAt: bEnd,
      allowsVideo: false, status: 'COMPLETED',
      flights: { create: bFlights.map((f) => ({ index: f.index, startAt: f.startAt, endAt: f.endAt, status: 'ENDED' })) },
    },
  });

  console.log(`Seeded vendor ${email} (password: demo1234) with 2 campaigns for brand ${BRAND}.`);
  console.log(`User id: ${user.id}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
