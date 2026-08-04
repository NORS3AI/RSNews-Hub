import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_ADS } from '../src/lib/ads';

const prisma = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}
function readMinutes(c: string) {
  return Math.max(1, Math.round(c.trim().split(/\s+/).length / 200));
}

async function main() {
  console.log('Seeding RSNews Hub…');

  const adminPass = await bcrypt.hash('admin123', 10);
  const userPass = await bcrypt.hash('reader123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@rsnews.local' },
    update: {},
    create: {
      email: 'admin@rsnews.local',
      name: 'Site Admin',
      passwordHash: adminPass,
      role: 'ADMIN',
      status: 'ACTIVE',
      bio: 'The RSNews Hub administrator.',
    },
  });

  await prisma.user.upsert({
    where: { email: 'reader@rsnews.local' },
    update: {},
    create: {
      email: 'reader@rsnews.local',
      name: 'Jane Reader',
      passwordHash: userPass,
      role: 'USER',
      status: 'ACTIVE',
    },
  });

  const categoryData = [
    { name: 'Product', color: '#316bff', description: 'Product updates and launches.' },
    { name: 'Engineering', color: '#0ea5e9', description: 'Deep dives into how we build.' },
    { name: 'Company', color: '#8b5cf6', description: 'News from the team.' },
    { name: 'Guides', color: '#10b981', description: 'How-tos and documentation.' },
    { name: 'Industry', color: '#f59e0b', description: 'Trends and analysis.' },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), color: c.color, description: c.description },
    });
    categories[c.name] = cat.id;
  }

  const tagNames = ['release', 'security', 'tutorial', 'ai', 'performance', 'design', 'api', 'roadmap', 'best-practices', 'announcement'];
  const tags: Record<string, string> = {};
  for (const t of tagNames) {
    const tag = await prisma.tag.upsert({ where: { slug: slugify(t) }, update: {}, create: { name: t, slug: slugify(t) } });
    tags[t] = tag.id;
  }

  const articles = [
    { title: 'Introducing RSNews Hub', category: 'Company', tags: ['announcement', 'release'], featured: true,
      content: `<p>Today we are thrilled to launch <strong>RSNews Hub</strong>, a modern home for our articles, guides and announcements.</p><p>The Hub brings together everything in one searchable, mobile-friendly place. You can browse by category, follow tags, subscribe to topics you care about, and get personalized recommendations based on what you read.</p><h2>What you can do</h2><ul><li>Read articles with a clean, distraction-free reader.</li><li>Discover related content automatically.</li><li>Subscribe to categories and never miss an update.</li></ul><p>We're just getting started. Welcome aboard.</p>` },
    { title: 'How Our Recommendation Engine Works', category: 'Engineering', tags: ['ai', 'performance', 'best-practices'],
      content: `<p>Great content is only useful if people can find it. Our recommendation engine scores every article against what you're reading using a blend of shared tags and category affinity.</p><h2>Content-based scoring</h2><p>When you finish an article, we look at its tags and category, then rank other published pieces by overlap. Shared tags are weighted heavily, with a bonus for same-category matches.</p><h2>Personalization</h2><p>Over time, your reading history builds an interest profile that powers your personalized feed on the home page.</p>` },
    { title: 'A Practical Guide to Writing Great Articles', category: 'Guides', tags: ['tutorial', 'best-practices', 'design'],
      content: `<p>Writing for the web is a craft. Here are the principles our editors follow.</p><h2>Lead with the point</h2><p>Put the most important information first. Readers skim.</p><h2>Use structure</h2><p>Headings, short paragraphs and lists make long pieces approachable on any device.</p><h2>Edit ruthlessly</h2><p>Every sentence should earn its place.</p>` },
    { title: 'Shipping Faster with Continuous Delivery', category: 'Engineering', tags: ['performance', 'best-practices', 'api'],
      content: `<p>We ship dozens of times a day. Here's the pipeline that makes it safe.</p><p>Automated tests, preview environments and progressive rollouts let us move quickly without breaking things. Every change is reviewed, tested and observable in production within minutes.</p>` },
    { title: 'Security Best Practices for Modern Apps', category: 'Engineering', tags: ['security', 'best-practices'], featured: true,
      content: `<p>Security is everyone's responsibility. This guide covers the essentials every team should have in place.</p><h2>Authentication</h2><p>Hash passwords, use secure sessions, and enforce least privilege.</p><h2>Data protection</h2><p>Encrypt in transit and at rest. Validate all input. Never trust the client.</p>` },
    { title: 'Our Product Roadmap for the Year', category: 'Product', tags: ['roadmap', 'announcement'],
      content: `<p>Here's a look at what we're building over the coming months, straight from the team.</p><p>We're focused on three themes: making the reading experience delightful, giving admins powerful tools, and opening up an API so you can build on top of the Hub.</p>` },
    { title: 'Designing for Every Screen', category: 'Guides', tags: ['design', 'tutorial'],
      content: `<p>Responsive design isn't optional. Your readers are on phones, tablets and desktops — often the same person across a single day.</p><p>Start mobile-first, use fluid layouts, and test on real devices. Typography and touch targets matter as much as the grid.</p>` },
    { title: 'The State of the Industry in 2026', category: 'Industry', tags: ['ai', 'announcement'],
      content: `<p>The pace of change keeps accelerating. Here's our take on where things are heading.</p><p>AI-assisted workflows are now table stakes. The winners will be teams that combine automation with genuine editorial judgment.</p>` },
    { title: 'Building an Accessible Reading Experience', category: 'Guides', tags: ['design', 'best-practices'],
      content: `<p>Accessibility makes your content better for everyone. Semantic markup, sufficient contrast and keyboard navigation are the foundation.</p><p>We test with screen readers and honor reduced-motion preferences throughout the Hub.</p>` },
    { title: 'Performance Wins That Actually Matter', category: 'Engineering', tags: ['performance', 'tutorial'],
      content: `<p>Speed is a feature. We obsess over it. Here are the optimizations with the biggest real-world impact.</p><p>Server rendering, image optimization and smart caching keep pages fast even on slow connections.</p>` },
  ];

  let i = 0;
  for (const a of articles) {
    const slug = slugify(a.title);
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) continue;
    const daysAgo = articles.length - i;
    const publishedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const created = await prisma.article.create({
      data: {
        title: a.title,
        slug,
        content: a.content,
        excerpt: a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
        status: 'PUBLISHED',
        featured: (a as any).featured ?? false,
        views: Math.floor(Math.random() * 500) + 20,
        readMinutes: readMinutes(a.content),
        publishedAt,
        categoryId: categories[a.category],
        authorId: admin.id,
        tags: { create: a.tags.map((t) => ({ tagId: tags[t] })) },
      },
    });
    i++;
    void created;
  }

  // An archived and a trashed example so the admin views have data.
  const archivedSlug = 'legacy-announcement-2024';
  if (!(await prisma.article.findUnique({ where: { slug: archivedSlug } }))) {
    await prisma.article.create({
      data: { title: 'Legacy Announcement (2024)', slug: archivedSlug, content: '<p>An older post kept for the archive.</p>',
        excerpt: 'An older post kept for the archive.', status: 'ARCHIVED', publishedAt: new Date('2024-01-15'),
        categoryId: categories['Company'], authorId: admin.id },
    });
  }

  await prisma.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      title: 'About RSNews Hub', slug: 'about', status: 'PUBLISHED',
      content: `<p>RSNews Hub is our central place for news, articles and documentation. It's built to be fast, accessible and easy to search.</p><p>Have feedback? We'd love to hear it.</p>`,
    },
  });

  // Smart in-article ads (idempotent by id).
  for (const ad of DEFAULT_ADS) {
    await prisma.ad.upsert({
      where: { id: ad.id },
      update: { imageWide: ad.imageWide ?? null, imageRect: ad.imageRect ?? null },
      create: {
        id: ad.id, brand: ad.brand, label: ad.label, headline: ad.headline,
        cta: ad.cta, href: ad.href, accent: ad.accent,
        keywords: ad.keywords, competitors: ad.competitors,
        imageWide: ad.imageWide ?? null, imageRect: ad.imageRect ?? null, active: ad.active,
      },
    });
  }

  // Curated Industry News links (idempotent by url).
  const industry = [
    { title: 'Small businesses lean on pack-and-ship services amid e-commerce boom', url: 'https://www.reuters.com/business/retail-consumer/', source: 'Reuters', views: 214, order: 0, days: 1 },
    { title: 'USPS announces 2026 shipping rate changes for retailers', url: 'https://www.usps.com/business/', source: 'USPS', views: 158, order: 1, days: 2 },
    { title: 'How independent shipping stores are competing with the big carriers', url: 'https://www.forbes.com/small-business/', source: 'Forbes', views: 96, order: 2, days: 3 },
    { title: 'Print-on-demand market projected to double by 2030', url: 'https://www.bloomberg.com/', source: 'Bloomberg', views: 73, order: 3, days: 5 },
    { title: 'Packaging supply costs ease as materials stabilize', url: 'https://www.wsj.com/business/', source: 'WSJ', views: 61, order: 4, days: 6 },
    { title: 'Retail foot traffic rebounds for local service counters', url: 'https://apnews.com/hub/business', source: 'AP News', views: 44, order: 5, days: 8 },
  ];
  for (const l of industry) {
    const existing = await prisma.industryLink.findFirst({ where: { url: l.url } });
    if (!existing) {
      await prisma.industryLink.create({
        data: { title: l.title, url: l.url, source: l.source, views: l.views, order: l.order,
          postedAt: new Date(Date.now() - l.days * 24 * 60 * 60 * 1000) },
      });
    }
  }

  // Sample monthly poll (only if none exist yet).
  if ((await prisma.poll.count()) === 0) {
    await prisma.poll.create({
      data: {
        question: 'What should we cover more this month?',
        active: true,
        options: {
          create: [
            { label: 'Shipping & carrier tips', order: 0, votes: 128 },
            { label: 'Running the storefront', order: 1, votes: 94 },
            { label: 'Marketing & local growth', order: 2, votes: 76 },
            { label: 'Industry news & trends', order: 3, votes: 51 },
          ],
        },
      },
    });
  }

  console.log('Seed complete. Admin login: admin@rsnews.local / admin123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
