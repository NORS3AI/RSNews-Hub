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
  console.log('Seeding RS News Hub…');

  // Admin credentials come from the environment. Demo defaults are used only
  // outside production; in production they are REQUIRED so no site ever ships
  // with the public admin/admin123 login.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@rsnews.local';
  const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  if (process.env.NODE_ENV === 'production' && (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD)) {
    throw new Error('Refusing to seed with default admin credentials in production. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.');
  }

  const adminPass = await bcrypt.hash(adminPasswordPlain, 10);
  const userPass = await bcrypt.hash('reader123', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Site Admin',
      passwordHash: adminPass,
      role: 'ADMIN',
      status: 'ACTIVE',
      bio: 'The RS News Hub administrator.',
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

  // Deep, cohesive palette that sits with the orange/slate brand — 10 distinct
  // hues around the wheel, none pastel. Fine-tune any of these in Admin →
  // Categories (colours are editable per category now).
  const categoryData = [
    { name: 'Breaking News', color: '#d23b2e', description: 'Time-sensitive news; the badge auto-expires.' },
    { name: "What's Hot", color: '#e07a2f', description: 'Trending and popular right now.' },
    { name: 'Recap', color: '#b08430', description: 'Summaries and recaps.' },
    { name: 'Column', color: '#2f8079', description: 'Opinion and recurring columns.' },
    { name: 'Upcoming Events', color: '#2f7d55', description: "What's coming up." },
    { name: 'Blog', color: '#3f6fb0', description: 'Regular blog posts.' },
    { name: 'Education', color: '#5a53a8', description: 'Learning resources and how-tos.' },
    { name: 'Feature Article', color: '#8a4f97', description: 'In-depth featured stories.' },
    { name: 'RS Council Column', color: '#9b2d3a', description: 'Columns from the RS Council.' },
    { name: 'Bulletin', color: '#5b6675', description: 'Short official notices.' },
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
    { title: 'Introducing RS News Hub', category: 'Feature Article', tags: ['announcement', 'release'], featured: true, coverImage: '/covers/cover-intro.jpg',
      content: `<p>Today we are thrilled to launch <strong>RS News Hub</strong>, a modern home for our articles, guides and announcements.</p><p>The Hub brings together everything in one searchable, mobile-friendly place. You can browse by category, follow tags, subscribe to topics you care about, and get personalized recommendations based on what you read.</p><h2>What you can do</h2><ul><li>Read articles with a clean, distraction-free reader.</li><li>Discover related content automatically.</li><li>Subscribe to categories and never miss an update.</li></ul><p>We're just getting started. Welcome aboard.</p>` },
    { title: 'How Our Recommendation Engine Works', category: 'Blog', tags: ['ai', 'performance', 'best-practices'],
      content: `<p>Great content is only useful if people can find it. Our recommendation engine scores every article against what you're reading using a blend of shared tags and category affinity.</p><h2>Content-based scoring</h2><p>When you finish an article, we look at its tags and category, then rank other published pieces by overlap. Shared tags are weighted heavily, with a bonus for same-category matches.</p><h2>Personalization</h2><p>Over time, your reading history builds an interest profile that powers your personalized feed on the home page.</p>` },
    { title: 'A Practical Guide to Writing Great Articles', category: 'Education', tags: ['tutorial', 'best-practices', 'design'],
      content: `<p>Writing for the web is a craft. Here are the principles our editors follow.</p><h2>Lead with the point</h2><p>Put the most important information first. Readers skim.</p><h2>Use structure</h2><p>Headings, short paragraphs and lists make long pieces approachable on any device.</p><h2>Edit ruthlessly</h2><p>Every sentence should earn its place.</p>` },
    { title: 'Shipping Faster with Continuous Delivery', category: 'Blog', tags: ['performance', 'best-practices', 'api'],
      content: `<p>We ship dozens of times a day. Here's the pipeline that makes it safe.</p><p>Automated tests, preview environments and progressive rollouts let us move quickly without breaking things. Every change is reviewed, tested and observable in production within minutes.</p>` },
    { title: 'Security Best Practices for Modern Apps', category: 'Feature Article', extra: ["What's Hot"], tags: ['security', 'best-practices'], featured: true, coverImage: '/covers/cover-security.jpg',
      content: `<p>Security is everyone's responsibility. This guide covers the essentials every team should have in place.</p><h2>Authentication</h2><p>Hash passwords, use secure sessions, and enforce least privilege.</p><h2>Data protection</h2><p>Encrypt in transit and at rest. Validate all input. Never trust the client.</p>` },
    { title: 'Our Product Roadmap for the Year', category: 'Bulletin', extra: ['Upcoming Events'], tags: ['roadmap', 'announcement'],
      content: `<p>Here's a look at what we're building over the coming months, straight from the team.</p><p>We're focused on three themes: making the reading experience delightful, giving admins powerful tools, and opening up an API so you can build on top of the Hub.</p>` },
    { title: 'Designing for Every Screen', category: 'Education', tags: ['design', 'tutorial'],
      content: `<p>Responsive design isn't optional. Your readers are on phones, tablets and desktops — often the same person across a single day.</p><p>Start mobile-first, use fluid layouts, and test on real devices. Typography and touch targets matter as much as the grid.</p>` },
    { title: 'The State of the Industry in 2026', category: "What's Hot", extra: ['Blog'], tags: ['ai', 'announcement'],
      content: `<p>The pace of change keeps accelerating. Here's our take on where things are heading.</p><p>AI-assisted workflows are now table stakes. The winners will be teams that combine automation with genuine editorial judgment.</p>` },
    // A live Breaking News item: primary topic is Bulletin, also flagged
    // Breaking News, with a 48h timer that auto-expires the badge.
    { title: 'USPS Announces Emergency Rate Change', category: 'Bulletin', extra: ['Breaking News'], breakingHours: 48, tags: ['announcement'], featured: true,
      content: `<p>The Postal Service has issued an unscheduled rate adjustment effective immediately, citing peak-season volume.</p><p>Operators should update point-of-sale pricing today. A full breakdown of the affected service tiers is below, and we will keep this post current as details are confirmed.</p>` },
    { title: 'Building an Accessible Reading Experience', category: 'Education', tags: ['design', 'best-practices'],
      content: `<p>Accessibility makes your content better for everyone. Semantic markup, sufficient contrast and keyboard navigation are the foundation.</p><p>We test with screen readers and honor reduced-motion preferences throughout the Hub.</p>` },
    { title: 'Performance Wins That Actually Matter', category: 'Blog', tags: ['performance', 'tutorial'],
      content: `<p>Speed is a feature. We obsess over it. Here are the optimizations with the biggest real-world impact.</p><p>Server rendering, image optimization and smart caching keep pages fast even on slow connections.</p>` },
    // RS Council columns — shown in full inside the column module.
    { title: 'On Patience in the First Year', category: 'RS Council Column', tags: ['best-practices'],
      content: `<p>Every new operator wants to change everything in month one. Resist. The counter has a rhythm, and the fastest way to lose your team is to break it before you understand it.</p><p>Watch first. Learn who your regulars are, which services carry the month, and where the quiet friction lives. The changes you make in year two, built on that knowledge, will stick. The ones you force in week two rarely do.</p><p>Patience is not passivity. It is the discipline of earning the right to lead.</p>` },
    { title: 'Why We Still Believe in the Counter', category: 'RS Council Column', tags: ['best-practices'],
      content: `<p>Plenty of people will tell you the retail counter is finished — that everything moves to a screen eventually. We disagree, and not out of nostalgia.</p><p>The counter is where trust is built one package at a time. A customer who hands you something fragile is handing you a small piece of their day. Software cannot hold that. People can.</p><p>Invest in the moment of handoff. It is the most defensible thing you own.</p>` },
    { title: 'The Case for Saying No', category: 'RS Council Column', tags: ['best-practices'],
      content: `<p>Growth tempts you to say yes to every service, every partner, every add-on. But a business is defined as much by what it declines as by what it offers.</p><p>Every yes is a claim on your counter space, your training time, and your attention. Say yes to the few things you can do better than anyone nearby, and say no — politely, firmly — to the rest.</p><p>Focus is not a limitation. It is a strategy.</p>` },
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
        coverImage: (a as any).coverImage ?? null,
        status: 'PUBLISHED',
        featured: (a as any).featured ?? false,
        views: Math.floor(Math.random() * 500) + 20,
        readMinutes: readMinutes(a.content),
        publishedAt,
        categoryId: categories[a.category],
        extraCategories: { connect: (((a as any).extra as string[] | undefined) ?? []).map((n) => ({ id: categories[n] })) },
        breakingUntil: (a as any).breakingHours ? new Date(Date.now() + (a as any).breakingHours * 3600 * 1000) : null,
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
        categoryId: categories['Blog'], authorId: admin.id },
    });
  }

  await prisma.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      title: 'About RS News Hub', slug: 'about', status: 'PUBLISHED',
      content: `<p>RS News Hub is our central place for news, articles and documentation. It's built to be fast, accessible and easy to search.</p><p>Have feedback? We'd love to hear it.</p>`,
    },
  });

  // Legal pages — starting TEMPLATES. Edit them in Admin → Pages and have them
  // reviewed by counsel before public launch; fill the [bracketed] blanks with
  // your real business name, address, jurisdiction and contact addresses.
  // `update: {}` keeps any admin edits on re-seed.
  await prisma.page.upsert({
    where: { slug: 'privacy' },
    update: {},
    create: {
      title: 'Privacy Policy', slug: 'privacy', status: 'PUBLISHED',
      content: `<p><em>Last updated: [DATE]. This is a starting template — please have it reviewed by legal counsel and replace the [bracketed] details before relying on it.</em></p>
<p>This Privacy Policy explains how RS News Hub ("we", "us") collects, uses and protects information when you use this site.</p>
<h2>Information we collect</h2>
<ul><li><strong>Account information</strong> — if you sign in as a member, we keep your name, email and account preferences.</li><li><strong>Content you submit</strong> — newsletter sign-ups, poll and quiz responses, saved articles and clippings.</li><li><strong>Usage information</strong> — pages viewed, articles read and general device/browser details, collected with first-party analytics to understand what readers find useful.</li><li><strong>Cookies</strong> — small files used to keep you signed in, remember your preferences (like theme) and measure readership.</li></ul>
<h2>How we use information</h2>
<p>To operate the site, keep you signed in, remember your preferences, send the newsletter you asked for, understand what content is valuable, and keep the service secure.</p>
<h2>Cookies &amp; analytics</h2>
<p>We use first-party analytics only. You can decline analytics cookies from the notice shown on your first visit; declining does not affect signing in or your saved preferences.</p>
<h2>How information is shared</h2>
<p>We do not sell your personal information. We share it only with service providers who help us run the site (for example hosting and email delivery), and where required by law.</p>
<h2>Your choices</h2>
<p>You can unsubscribe from the newsletter at any time using the link in each email, update or delete your account, and request a copy of your data by contacting us. To exercise these rights, email <a href="mailto:[privacy@yourdomain.com]">[privacy@yourdomain.com]</a>.</p>
<h2>Data retention</h2>
<p>We keep information for as long as your account is active or as needed to provide the service, then delete or anonymize it.</p>
<h2>Children</h2>
<p>This site is not directed to children under [13/16], and we do not knowingly collect their information.</p>
<h2>Changes</h2>
<p>We may update this policy; material changes will be posted here with a new "last updated" date.</p>
<h2>Contact</h2>
<p>Questions? Email <a href="mailto:[privacy@yourdomain.com]">[privacy@yourdomain.com]</a> or write to [Your business name and address].</p>`,
    },
  });
  await prisma.page.upsert({
    where: { slug: 'terms' },
    update: {},
    create: {
      title: 'Terms of Service', slug: 'terms', status: 'PUBLISHED',
      content: `<p><em>Last updated: [DATE]. This is a starting template — please have it reviewed by legal counsel and replace the [bracketed] details before relying on it.</em></p>
<p>These Terms of Service ("Terms") govern your use of RS News Hub. By using the site, you agree to these Terms.</p>
<h2>The service</h2>
<p>RS News Hub provides news, articles and related content. We may add, change or remove features at any time.</p>
<h2>Accounts</h2>
<p>If you create or sign in to an account, you are responsible for keeping your credentials secure and for activity under your account. You must provide accurate information and be old enough to form a binding contract.</p>
<h2>Acceptable use</h2>
<p>Don't misuse the service: no unlawful activity, no attempts to breach security, no scraping or overloading the site, and no infringing or harmful content in anything you submit.</p>
<h2>Content &amp; intellectual property</h2>
<p>Articles, branding and site content are owned by us or our licensors and may not be copied or redistributed without permission, except as the site's sharing features allow. Anything you submit, you grant us permission to display in connection with the service.</p>
<h2>Advertising &amp; third-party links</h2>
<p>The site may show advertising and link to third-party sites. We are not responsible for third-party content or practices.</p>
<h2>Disclaimers</h2>
<p>The service is provided "as is" without warranties of any kind. We do not guarantee the site will be uninterrupted, error-free or that content is complete or accurate.</p>
<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, we are not liable for indirect, incidental or consequential damages arising from your use of the service.</p>
<h2>Changes to these Terms</h2>
<p>We may update these Terms; continued use after changes means you accept them.</p>
<h2>Governing law</h2>
<p>These Terms are governed by the laws of [State/Country], without regard to conflict-of-laws rules.</p>
<h2>Contact</h2>
<p>Questions? Email <a href="mailto:[legal@yourdomain.com]">[legal@yourdomain.com]</a>.</p>`,
    },
  });
  await prisma.page.upsert({
    where: { slug: 'copyright' },
    update: {},
    create: {
      title: 'Copyright & DMCA', slug: 'copyright', status: 'PUBLISHED',
      content: `<p><em>Last updated: [DATE]. This is a starting template — please have it reviewed by legal counsel and replace the [bracketed] details before relying on it.</em></p>
<h2>Copyright</h2>
<p>© ${new Date().getFullYear()} [Your business name]. All articles, images, branding and other content on RS News Hub are protected by copyright and owned by us or our licensors, except for third-party material (such as advertisements or linked industry news) which remains the property of its respective owners. You may not copy, reproduce, republish or redistribute our content without written permission, except as the site's built-in sharing and clipping features expressly allow.</p>
<h2>Using our content</h2>
<p>Short quotations with attribution and a link back are generally welcome. For anything more — reprints, syndication, commercial use — contact <a href="mailto:[legal@yourdomain.com]">[legal@yourdomain.com]</a>.</p>
<h2>Copyright complaints (DMCA)</h2>
<p>We respect the intellectual-property rights of others and respond to notices of alleged infringement that comply with the U.S. Digital Millennium Copyright Act (DMCA) and comparable laws. If you believe content on this site infringes your copyright, send a written notice to our designated agent that includes all of the following:</p>
<ul>
<li>Your physical or electronic signature.</li>
<li>Identification of the copyrighted work you claim has been infringed.</li>
<li>Identification of the material you claim is infringing, with enough detail (such as a URL) for us to locate it.</li>
<li>Your name, mailing address, telephone number and email address.</li>
<li>A statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent or the law.</li>
<li>A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner's behalf.</li>
</ul>
<h2>Designated agent</h2>
<p>Send DMCA notices to our copyright agent:<br>[Agent name]<br>[Your business name]<br>[Mailing address]<br>Email: <a href="mailto:[dmca@yourdomain.com]">[dmca@yourdomain.com]</a></p>
<h2>Counter-notice</h2>
<p>If you believe material you posted was removed in error, you may send a counter-notice to the same agent with the information required by the DMCA. We may restore the material unless the original complainant files a court action.</p>
<h2>Repeat infringers</h2>
<p>We may, in appropriate circumstances, disable or terminate accounts of users who are repeat infringers.</p>`,
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

  // Sample polls: one active + two archived past polls (only if none exist).
  if ((await prisma.poll.count()) === 0) {
    await prisma.poll.create({
      data: {
        question: 'What should we cover more this month?', active: true,
        options: { create: [
          { label: 'Shipping & carrier tips', order: 0, votes: 128 },
          { label: 'Running the storefront', order: 1, votes: 94 },
          { label: 'Marketing & local growth', order: 2, votes: 76 },
          { label: 'Industry news & trends', order: 3, votes: 51 },
        ] },
      },
    });
    await prisma.poll.create({
      data: {
        question: 'Busiest shipping day at your counter?', active: false, createdAt: new Date(Date.now() - 40 * 864e5),
        options: { create: [
          { label: 'Monday', order: 0, votes: 88 }, { label: 'Friday', order: 1, votes: 141 },
          { label: 'Saturday', order: 2, votes: 97 }, { label: 'It varies', order: 3, votes: 44 },
        ] },
      },
    });
    await prisma.poll.create({
      data: {
        question: 'Which service do customers ask about most?', active: false, createdAt: new Date(Date.now() - 70 * 864e5),
        options: { create: [
          { label: 'Shipping', order: 0, votes: 203 }, { label: 'Mailboxes', order: 1, votes: 76 },
          { label: 'Printing & copies', order: 2, votes: 58 }, { label: 'Notary', order: 3, votes: 39 },
        ] },
      },
    });
  }

  // Sample Pop Quiz: one live (closes in 44h) + one archived/closed.
  if ((await prisma.quiz.count()) === 0) {
    await prisma.quiz.create({
      data: {
        title: 'Shipping & counter trivia', active: true,
        closesAt: new Date(Date.now() + 44 * 3600_000), submissions: 37,
        questions: { create: [
          { prompt: 'What does a package’s "dimensional weight" measure?', order: 0, options: { create: [
            { label: 'Its size relative to its weight', correct: true, order: 0, count: 21 },
            { label: 'How much it weighs on a scale', order: 1, count: 9 },
            { label: 'The thickness of the box wall', order: 2, count: 7 },
          ] } },
          { prompt: 'Which class of mail is NOT tracked by default?', order: 1, options: { create: [
            { label: 'Priority Mail', order: 0, count: 5 },
            { label: 'First-Class Letter', correct: true, order: 1, count: 26 },
            { label: 'Ground Advantage', order: 2, count: 6 },
          ] } },
          { prompt: 'Best way to cushion a fragile item?', order: 2, options: { create: [
            { label: 'Two inches of padding on all sides', correct: true, order: 0, count: 24 },
            { label: 'Fill only the bottom of the box', order: 1, count: 4 },
            { label: 'Tape the item to the box wall', order: 2, count: 9 },
          ] } },
        ] },
      },
    });
    await prisma.quiz.create({
      data: {
        title: 'Last week: mailbox know-how', active: false,
        createdAt: new Date(Date.now() - 9 * 864e5), closesAt: new Date(Date.now() - 7 * 864e5), submissions: 62,
        questions: { create: [
          { prompt: 'How long must a business hold a customer’s mail by default?', order: 0, options: { create: [
            { label: '30 days', order: 0, count: 18 },
            { label: 'Per the mailbox agreement', correct: true, order: 1, count: 33 },
            { label: 'Indefinitely', order: 2, count: 11 },
          ] } },
        ] },
      },
    });
  }

  // Backroom Humor comics: one active (homepage) + two archived.
  if ((await prisma.comic.count()) === 0) {
    // All active by default so the homepage module cycles through them; archive
    // individual comics from the admin to drop them out of the rotation.
    const comics = [
      { title: 'Stamps then vs now', image: '/comics/comic-stamps.jpg', caption: 'Back in 1987, licking a few stamps a day was considered part of a balanced diet.', active: true, days: 40 },
      { title: 'Keeping the lobby clean', image: '/comics/comic-lobby.jpg', caption: 'Some mailbox holders collect their mail. Others simply relocate it six feet to the left.', active: true, days: 20 },
      { title: 'Meanwhile, in Texas', image: '/comics/comic-texas.jpg', caption: 'Packing 101 teaches the basics. Packing 102 covers Texas.', active: true, days: 2 },
    ];
    for (const c of comics) {
      await prisma.comic.create({ data: { title: c.title, image: c.image, caption: c.caption, active: c.active, postedAt: new Date(Date.now() - c.days * 864e5) } });
    }
  }

  console.log(`Seed complete. Admin login: ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : 'admin123'}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
