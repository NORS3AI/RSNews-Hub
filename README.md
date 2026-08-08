# RSNews Hub

A modern, embeddable news & documentation hub. Admins post and organize
articles; readers browse, search, get personalized recommendations, and
subscribe to topics — all fully responsive across mobile, tablet and desktop.

The public hub lives under **`/docs`** (with `/` and `/main` redirecting there),
so it can sit alongside a main website today and be embedded later.

> **New here?** Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a map of the
> codebase, then [`DEPLOYMENT.md`](./DEPLOYMENT.md) to ship and
> [`INTEGRATION.md`](./INTEGRATION.md) to connect it to the RS News site.

## 🔗 Live site

**https://nors3ai.github.io/RSNews-Hub/**

Published via GitHub Pages (source: `main` branch, `/docs` folder). Note the
casing: the host (`nors3ai.github.io`) is lowercase, but the repository path
segment is **case-sensitive** and must match the repo name exactly —
`RSNews-Hub`, not `rsnews-hub`.

### About the Pages preview

GitHub Pages serves **static files only**, but the app itself is server-driven
(database, API routes, auth, admin). So the `/docs` folder holds a
**self-contained static preview** — a client-side snapshot of the reading
experience: the design, headline block, modular cards, category browsing,
in-browser search, the star strip and the article modal (stars are saved in
`localStorage`). Admin, accounts and server-side search/recommendations only
run in the full Next.js app (`npm run dev`, or any Node host).

Regenerate the preview's content snapshot after changing articles:

```bash
npm run db:seed        # or edit content via the admin panel
npm run build:static   # rewrites docs/data.js from the database
```

`docs/index.html`, `docs/styles.css` and `docs/app.js` are the static site;
`docs/data.js` is the generated content.

## Features

### For readers
- **Clean reader** with reading-progress bar and view tracking.
- **Smart search** — weighted relevance across titles, tags, categories and
  body content, with live type-ahead suggestions.
- **"If you read this, you might like…"** — a content-based recommendation
  engine that scores articles by shared tags + category affinity, plus a
  personalized home feed built from your reading history (works even before you
  sign in, via an anonymous reader cookie).
- **Read next** links to move straight to the following article.
- **Archive** grouped by month, **categories** and **tags** browsing.
- **Subscriptions** to individual categories or to all articles.
- Accounts with reading history and subscription management.
- **Light / dark theme**, keyboard-friendly, respects reduced-motion.

### For admins (`/admin`)
- **Dashboard** with content, view and user stats.
- **Articles**: create/edit (HTML editor with live preview), publish,
  unpublish, **archive**, **trash** and permanently delete. Featured articles,
  cover images, auto-excerpts, auto read-time, on-the-fly tag creation.
- **Pages**: manage standalone content pages (e.g. About) at `/docs/page/<slug>`.
- **Categories** & **Tags**: full CRUD with colors and article counts.
- **Users (small CRM)**: search/filter, add users, edit profile/role,
  **suspend**, **ban**, activate, reset passwords, private admin notes, and
  delete — with per-user activity stats. Admins can't lock themselves out.

Roles: `ADMIN` (full access incl. user CRM), `EDITOR` (content only), `USER`.
The first account ever created is automatically an admin.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Prisma** ORM with **PostgreSQL**
- **Tailwind CSS** for responsive, themeable UI
- Session auth via signed JWT cookies (`jose` + `bcryptjs`) — no external
  auth service required
- Server Actions for admin mutations; API routes for auth, search, reading
  and subscriptions

## Getting started

```bash
npm install                 # installs deps + generates the Prisma client
cp .env.example .env        # then edit AUTH_SECRET
docker compose up -d db     # start local PostgreSQL (or point DATABASE_URL at your own)
npm run db:push             # create the database schema
npm run db:seed             # seed demo content + accounts
npm run dev                 # http://localhost:3000  → redirects to /docs
```

### Seeded accounts
| Role  | Email                 | Password    |
|-------|-----------------------|-------------|
| Admin | `admin@rsnews.local`  | `admin123`  |
| User  | `reader@rsnews.local` | `reader123` |

> Change these before deploying anywhere public.

## Scripts

| Command           | Description                                  |
|-------------------|----------------------------------------------|
| `npm run dev`     | Start the dev server                         |
| `npm run build`   | Generate Prisma client + production build    |
| `npm run start`   | Start the production server                  |
| `npm run db:push` | Apply the Prisma schema to the database      |
| `npm run db:seed` | Seed demo data                               |

## Project structure

```
prisma/
  schema.prisma      # data model (User, Article, Category, Tag, Page,
                     #   Subscription, ReadingLog)
  seed.ts            # demo content + accounts
src/
  app/
    (site)/          # public site: /docs, article reader, categories,
                     #   archive, search, subscriptions, login/register/account
    admin/           # admin panel: dashboard, articles, pages, categories,
                     #   tags, users (CRM)
    api/             # auth, search, reading, subscriptions, health
  components/        # UI + admin components
  lib/
    auth.ts          # sessions, hashing, guards
    recommend.ts     # smart search + recommendation engine
    actions.ts       # admin server actions (CRUD)
    db.ts, utils.ts, queries.ts, constants.ts
  middleware.ts      # assigns anonymous reader id for recommendations
```

## Embedding on the main site

For now the hub is a standalone app served at `/docs`. To embed it into an
existing site you can either reverse-proxy `/docs` to this app or drop it into
an `<iframe>`. Because every reader page is server-rendered and mobile-first,
it adapts to whatever container it lands in.

## Production notes

- Set a strong `AUTH_SECRET`.
- For a hosted database, change the `datasource` provider in
  `prisma/schema.prisma` to `postgresql` and update `DATABASE_URL`.
- Article/page content is stored as HTML and rendered with
  `dangerouslySetInnerHTML`; since only trusted admins/editors author content
  this is intentional. If you later allow untrusted authors, add HTML
  sanitization before rendering.
