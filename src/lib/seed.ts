import { getDb } from './db';
import { createUser, countUsers } from './users';
import { createArticle, createCategory, listCategories } from './articles';
import { createPage } from './pages';

/**
 * Idempotent bootstrap. Runs once per process (guarded by a module flag) and
 * only inserts data that is missing, so it is safe on every boot.
 */
let done = false;

export function ensureSeeded(): void {
  if (done) return;
  done = true;
  const db = getDb();

  // ---- Admin account -----------------------------------------------------
  if (countUsers() === 0) {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@rsnews.local';
    const password = process.env.SEED_ADMIN_PASSWORD || 'admin1234';
    createUser({ name: 'Site Admin', email, password, role: 'admin', status: 'active' });
    createUser({
      name: 'Jamie Reader',
      email: 'reader@rsnews.local',
      password: 'reader1234',
      role: 'user',
      status: 'active',
    });
  }

  // ---- Demo content ------------------------------------------------------
  const articleCount = (db.prepare('SELECT COUNT(*) AS n FROM articles').get() as { n: number }).n;
  if (articleCount > 0) return;

  const admin = db.prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`).get() as
    | { id: number }
    | undefined;
  const authorId = admin?.id ?? null;

  if (listCategories().length === 0) {
    createCategory('Company News', 'Announcements and updates from the team.');
    createCategory('Product', 'Deep dives into features and releases.');
    createCategory('Engineering', 'How we build things under the hood.');
    createCategory('Guides', 'Tutorials and how-tos.');
  }
  const cats = listCategories();
  const byName = (n: string) => cats.find((c) => c.name === n)?.id ?? null;

  const demo = [
    {
      title: 'Welcome to RSNews Hub',
      excerpt: 'A quick tour of the new home for our articles, guides and announcements.',
      body: `RSNews Hub is where we publish everything worth reading in one place.\n\nBrowse by category, follow the topics you care about, and let our recommendations surface the next thing you should read. This post is a friendly starting point — jump into any article and use "Read next" to keep going.`,
      category_id: byName('Company News'),
      tagNames: ['welcome', 'announcement'],
      status: 'published' as const,
    },
    {
      title: 'Introducing Smart Recommendations',
      excerpt: 'How the "if you read this, this might interest you" engine works.',
      body: `Every article now suggests related reading. We score other articles by the tags they share with what you are reading and whether they sit in the same category.\n\nWhen you are signed in, recommendations also learn from your reading history, so the more you read the sharper they get.`,
      category_id: byName('Product'),
      tagNames: ['recommendations', 'search', 'product'],
      status: 'published' as const,
    },
    {
      title: 'Building an Embeddable News Widget',
      excerpt: 'The architecture that lets RSNews Hub live inside the main site.',
      body: `RSNews Hub is a self-contained Next.js app backed by SQLite. It exposes clean routes such as /main and /docs that can be embedded into the marketing site via an iframe or reverse proxy.\n\nEverything renders server-side for fast first paint and good SEO, and the layout is fully responsive from phone to desktop.`,
      category_id: byName('Engineering'),
      tagNames: ['engineering', 'nextjs', 'architecture'],
      status: 'published' as const,
    },
    {
      title: 'How to Subscribe and Save Articles',
      excerpt: 'Never lose track of a story — subscribe and find it later.',
      body: `Signed-in readers can subscribe to any article or an entire category. Subscriptions show up on your dashboard so you can pick up where you left off.\n\nWe also keep a private reading history that powers your personalised recommendations.`,
      category_id: byName('Guides'),
      tagNames: ['guides', 'subscriptions'],
      status: 'published' as const,
    },
    {
      title: 'Searching the Archive',
      excerpt: 'Find anything we have ever published with fast full-text search.',
      body: `The search page looks across titles, summaries and full article text. Combine it with the archive, which groups every published story by month, to travel back through everything we have written.`,
      category_id: byName('Guides'),
      tagNames: ['guides', 'search', 'archive'],
      status: 'published' as const,
    },
    {
      title: 'Engineering Notes: Content Modelling',
      excerpt: 'Categories, tags and statuses — the shape of our content.',
      body: `Articles belong to a single category and can carry many tags. A workflow of draft → published → archived → trashed keeps the editorial process tidy, and the same tag graph drives related-article recommendations.`,
      category_id: byName('Engineering'),
      tagNames: ['engineering', 'architecture', 'content'],
      status: 'published' as const,
    },
  ];

  for (const d of demo) {
    createArticle({ ...d, author_id: authorId });
  }

  // ---- Static pages ------------------------------------------------------
  createPage({
    title: 'About RSNews Hub',
    slug: 'about',
    status: 'published',
    body: `RSNews Hub is our central place for news, product updates and guides. It is built to be embedded into the main website while remaining a first-class reading experience on its own.`,
  });
}
