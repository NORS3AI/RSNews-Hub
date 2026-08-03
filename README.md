# RSNews Hub

A self-contained news & articles platform: an admin CMS for publishing, a
polished reader experience with smart recommendations, full-text search, an
archive and subscriptions — designed to be embedded into a main website while
also working great on its own.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS + SQLite**.

---

## Features

### Reading
- **Home** (`/main`) — hero, featured + latest stories, category strip, and
  personalised recommendations when signed in.
- **Article reader** (`/articles/[slug]`) — clean typography, cover image,
  tags, view counter, **Read next →** navigation, and an
  **"If you read this, you might like"** related section.
- **Smart recommendations** — content-based scoring by shared tags (weighted)
  and category. For signed-in readers it also learns from reading history.
- **Search** (`/search`) — full-text across title, summary and body, plus tag
  filtering.
- **Archive** (`/archive`) — every published story grouped by month.
- **Categories** (`/categories`, `/categories/[slug]`).
- **Static pages** (`/docs`, `/p/[slug]`).

### Accounts & subscriptions
- Register / sign in with secure, HMAC-signed session cookies (passwords
  hashed with bcrypt).
- **Subscribe** to individual articles or whole categories.
- Personal **dashboard** (`/dashboard`) with subscriptions, reading history and
  recommendations.

### Admin backend (`/admin`)
- **Dashboard** with content stats.
- **Articles** — create, edit, publish, archive, trash/restore, delete; assign
  category and tags; filter and search.
- **Categories & tags** — manage categories; tags are created on the fly.
- **Pages** — create/edit/publish/trash static pages.
- **Users — CRM** (admin only) — add, edit, change roles (move), suspend, ban
  and delete members.

### Roles
- `admin` — full access, including the user CRM.
- `editor` — manage articles, categories and pages.
- `user` — read, subscribe, get recommendations.

Everything is **responsive** (mobile / tablet / desktop) with a collapsible
navigation and admin sidebar.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit values
npm run dev                  # http://localhost:3000
```

On first run the database is created and seeded automatically with demo
articles, categories, a static page and two accounts:

| Role  | Email                | Password    |
|-------|----------------------|-------------|
| admin | `admin@rsnews.local` | `admin1234` |
| user  | `reader@rsnews.local`| `reader1234`|

> Change these via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before first run,
> or edit the accounts in the admin CRM afterwards.

### Production

```bash
npm run build
npm start
```

---

## Configuration

| Variable              | Purpose                                              | Default                 |
|-----------------------|------------------------------------------------------|-------------------------|
| `SESSION_SECRET`      | Secret used to sign session cookies (**set this!**)  | insecure dev fallback   |
| `DATABASE_PATH`       | SQLite file location                                 | `./data/rsnews.db`      |
| `SEED_ADMIN_EMAIL`    | Initial admin email (first run only)                 | `admin@rsnews.local`    |
| `SEED_ADMIN_PASSWORD` | Initial admin password (first run only)              | `admin1234`             |

---

## Embedding into the main website

RSNews Hub exposes clean, embeddable routes (notably `/main` and `/docs`). You
can reverse-proxy those paths into the main site, or drop in an iframe:

```html
<iframe
  src="https://hub.example.com/main"
  style="width:100%;height:100vh;border:0"
  title="RSNews Hub"
></iframe>
```

The `/docs` page documents this in-app as well.

---

## Project structure

```
src/
  app/
    (site)/           # public reader experience (shared header/footer)
      main, docs, archive, search, categories, articles, p, dashboard,
      login, register
    admin/            # admin CMS + CRM (staff-guarded layout)
      articles, categories, pages, users, actions.ts (server actions)
    api/auth/*        # login / register / logout
    api/subscriptions # subscribe / unsubscribe
  components/         # UI: header, footer, cards, admin sidebar & forms
  lib/                # db, auth, guards, and repositories
                      #   (articles, users, pages, subscriptions, seed)
```

## Data & persistence

Data lives in a single SQLite file (WAL mode). It is created and migrated on
first connection and is git-ignored. For a durable deployment, point
`DATABASE_PATH` at a persistent volume.

## Tech notes

- Recommendations and search are pure SQL — no external services — which keeps
  the app easy to embed and cheap to run.
- Mutations in the admin use Next.js **Server Actions**; the public reader uses
  a couple of small JSON API routes (subscriptions).
