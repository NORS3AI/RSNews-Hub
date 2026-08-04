/**
 * Generates ~3 weeks of realistic demo analytics events so the admin dashboard
 * has something to show before the live site collects real data. Idempotent-ish:
 * only seeds when the table is nearly empty.  Usage: node scripts/seed-analytics.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const chance = (p) => Math.random() < p;

const DEVICES = ['desktop', 'desktop', 'desktop', 'mobile', 'mobile', 'tablet'];
const AD_PLACEMENTS = [
  { slot: 'home-leaderboard', shape: 'banner', fold: 0.85 },
  { slot: 'home-r1', shape: 'rectangle', fold: 0.2 },
  { slot: 'article-top', shape: 'banner', fold: 0.9 },
  { slot: 'article-bottom', shape: 'rectangle', fold: 0.05 },
  { slot: 'council-ad-1', shape: 'banner', fold: 0.15 },
];
const CAMPAIGNS = [
  { brand: 'PackageHub', creativeId: 'seed-packagehub', format: 'image' },
  { brand: 'PackWise', creativeId: 'seed-packwise', format: 'image' },
  { brand: 'PrintPilot', creativeId: 'seed-printpilot', format: 'image' },
  { brand: 'CloudDesk', creativeId: 'seed-clouddesk', format: 'text' },
];
const MODULES = [
  { module: 'feature-showcase', moduleType: 'showcase', img: 1.0 },
  { module: 'recommended', moduleType: 'carousel', img: 0.4 },
  { module: 'latest', moduleType: 'list', img: 0 },
  { module: 'trending', moduleType: 'list', img: 0 },
  { module: 'council', moduleType: 'column', img: 0 },
  { module: 'picks', moduleType: 'carousel', img: 0.4 },
];

async function main() {
  const existing = await prisma.analyticsEvent.count();
  if (existing > 500) { console.log(`Analytics already has ${existing} events; skipping.`); return; }

  const articles = await prisma.article.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, slug: true, coverImage: true, category: { select: { slug: true } } } });
  if (!articles.length) { console.log('No articles; seed articles first.'); return; }

  const rows = [];
  const now = Date.now();
  const visitors = Array.from({ length: 120 }, (_, i) => 'demo-v' + i);

  for (let d = 20; d >= 0; d--) {
    const dayBase = now - d * 864e5;
    const sessionsToday = 40 + rnd(40);
    for (let s = 0; s < sessionsToday; s++) {
      const visitor = pick(visitors);
      const device = pick(DEVICES);
      const sessionId = 'demo-s' + d + '-' + s;
      const t = () => new Date(dayBase + rnd(864e5));
      const base = { visitorId: visitor, sessionId, device };

      rows.push({ ...base, type: 'pageview', subjectType: 'hub', pageType: 'home', createdAt: t() });

      // Ad impressions/clicks on this session
      for (const p of AD_PLACEMENTS) {
        if (!chance(0.6)) continue;
        const camp = pick(CAMPAIGNS);
        const viewable = chance(0.8);
        const aboveFold = chance(p.fold);
        const dwellMs = 800 + rnd(6000);
        rows.push({ ...base, type: 'impression', subjectType: 'ad', placement: p.slot, pageType: p.slot.startsWith('article') ? 'article' : 'home',
          value: dwellMs, props: JSON.stringify({ brand: camp.brand, campaignId: camp.brand, creativeId: camp.creativeId, format: camp.format, shape: p.shape, viewable, aboveFold, dwellMs }), createdAt: t() });
        // clicks skew to above-fold image banners
        const clickP = (aboveFold ? 0.05 : 0.015) * (camp.format === 'image' ? 1.4 : 0.7);
        if (viewable && chance(clickP)) {
          rows.push({ ...base, type: 'click', subjectType: 'ad', placement: p.slot, pageType: p.slot.startsWith('article') ? 'article' : 'home',
            props: JSON.stringify({ brand: camp.brand, campaignId: camp.brand, creativeId: camp.creativeId, format: camp.format, shape: p.shape }), createdAt: t() });
        }
      }

      // Article card impressions + clicks across modules
      let opened = null;
      for (const m of MODULES) {
        const cards = 3 + rnd(4);
        for (let pos = 0; pos < cards; pos++) {
          const art = pick(articles);
          const hasImage = m.module === 'feature-showcase' ? true : (chance(m.img) && !!art.coverImage);
          rows.push({ ...base, type: 'impression', subjectType: 'article', placement: m.module, pageType: 'home',
            props: JSON.stringify({ module: m.module, moduleType: m.moduleType, pos, hasImage, category: art.category?.slug }), createdAt: t() });
          // CTR: image + higher position + showcase perform better
          const clickP = (hasImage ? 0.09 : 0.05) * Math.max(0.3, 1 - pos * 0.12) * (m.module === 'feature-showcase' ? 1.5 : 1);
          if (chance(clickP)) {
            rows.push({ ...base, type: 'click', subjectType: 'article', subjectId: art.slug, placement: m.module, pageType: 'home',
              props: JSON.stringify({ module: m.module, moduleType: m.moduleType, pos, hasImage }), createdAt: t() });
            if (!opened) opened = art;
          }
        }
      }

      // If they clicked, they open + read
      if (opened && chance(0.85)) {
        const ot = t();
        rows.push({ ...base, type: 'article_open', subjectType: 'article', subjectId: opened.id, pageType: 'article', placement: 'reader', props: JSON.stringify({ category: opened.category?.slug }), createdAt: ot });
        const activeMs = chance(0.2) ? 1000 + rnd(3000) : 20000 + rnd(180000);
        const scrollPct = Math.min(100, 20 + rnd(85));
        for (const ms of [25, 50, 75, 100]) if (scrollPct >= ms) rows.push({ ...base, type: 'read', subjectType: 'article', subjectId: opened.id, pageType: 'article', placement: 'reader', value: ms, props: JSON.stringify({ milestone: ms }), createdAt: ot });
        rows.push({ ...base, type: 'read', subjectType: 'article', subjectId: opened.id, pageType: 'article', placement: 'reader', value: activeMs, props: JSON.stringify({ activeMs, totalMs: activeMs + rnd(10000), scrollPct }), createdAt: ot });

        // Clippings sometimes
        if (chance(0.12)) {
          const kind = chance(0.5) ? 'comic' : 'quote';
          rows.push({ ...base, type: 'clip', subjectType: 'clip', pageType: kind === 'comic' ? 'home' : 'article', props: JSON.stringify({ action: 'save', kind, source: kind === 'comic' ? 'comic' : 'reader' }), createdAt: t() });
          if (chance(0.5)) rows.push({ ...base, type: 'clip', subjectType: 'clip', pageType: 'clippings', props: JSON.stringify({ action: 'download', kind }), createdAt: t() });
          if (chance(0.3)) rows.push({ ...base, type: 'clip', subjectType: 'clip', pageType: 'clippings', props: JSON.stringify({ action: 'expand', kind }), createdAt: t() });
        }
      }

      // Search sometimes
      if (chance(0.15)) {
        const zero = chance(0.2);
        rows.push({ ...base, type: 'search', subjectType: 'search', pageType: 'search', value: zero ? 0 : 1 + rnd(20), props: JSON.stringify({ query: pick(['shipping', 'postalmate', 'labels', 'mailbox', 'pricing', 'zzxx']), results: zero ? 0 : 1 + rnd(20), zeroResults: zero }), createdAt: t() });
      }
    }
  }

  // Bulk insert in chunks
  for (let i = 0; i < rows.length; i += 2000) {
    await prisma.analyticsEvent.createMany({ data: rows.slice(i, i + 2000) });
  }
  console.log(`Seeded ${rows.length} demo analytics events across 21 days.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
