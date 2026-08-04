# Deploying RSNews Hub

A step-by-step guide to take this repo from a local build to a live site. It's
written to be followed top-to-bottom by someone who hasn't seen the codebase.
Copy-paste the commands; the **Recommended** path at each fork is the simplest.

> **What's already done for you (in code):** Postgres-ready schema + a generated
> init SQL, environment validation that fails loudly on misconfig, an env-driven
> admin seed (no more `admin/admin123` in prod), a `/api/health` check, a
> `Dockerfile`, and `prisma migrate` scripts. You mostly provide credentials and
> click deploy. Details are called out as **[automated]** below.

---

## 0. How the pieces fit

There are **two** front-ends in this repo:

| Piece | What it is | Where it runs |
|------|------------|---------------|
| **The app** (`src/`) | The real Next.js app — homepage, articles, admin, accounts, polls/quizzes, analytics. Needs a Node server + a database. | A Node host (Railway / Vercel / Render / a VPS) |
| **The preview** (`docs/`) | A static, read-only snapshot for showing people the look. No backend, no login, no analytics. | GitHub Pages (already set up) |

**This guide deploys the app.** The preview is covered briefly at the end.

---

## 1. Pick a host + database

You need somewhere to run Node and a Postgres database.

- **Recommended (simplest — one platform for both): [Railway](https://railway.app).**
  Add a Postgres plugin and deploy the repo; Railway wires `DATABASE_URL` for you.
- **Alternative (canonical Next.js): [Vercel](https://vercel.com) for the app +
  [Neon](https://neon.tech) or [Supabase](https://supabase.com) for Postgres.**
- **Self-host / Docker:** any container host (Render, Fly.io, a VPS) using the
  included `Dockerfile`.

All three are covered in **Step 6**.

---

## 2. Switch the database to Postgres  **[you: 1-line change]**

Local dev uses SQLite; production uses Postgres. Change the datasource provider:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

The schema uses no SQLite-only features, so nothing else changes. A ready-made
Postgres schema is also committed at **`deploy/init.postgres.sql`** if you
prefer to apply SQL directly.

---

## 3. Set environment variables  **[automated: the app validates these]**

Set these in your host's dashboard (or a `.env` for a VPS). See `.env.example`.

| Variable | Required | Notes |
|----------|:--------:|-------|
| `DATABASE_URL` | ✅ | Your Postgres connection string (the host usually injects it). |
| `AUTH_SECRET` | ✅ | Session-signing secret. Generate: `openssl rand -base64 48`. **The app refuses to issue logins in production if this is weak/unset.** |
| `SEED_ADMIN_EMAIL` | ✅ (to seed) | Your real admin email. |
| `SEED_ADMIN_PASSWORD` | ✅ (to seed) | A strong admin password. Seeding **fails in production** without these — so the demo login can never ship. |
| `SITE_URL` | optional | Absolute URL used for Open Graph/meta tags, `robots.txt` and `sitemap.xml`. Set it in prod so links are absolute. |
| `RESEND_API_KEY` | optional | Enables real email (see §3a). Unset → email is **logged, not sent**. |
| `EMAIL_FROM` | optional | Verified sender, e.g. `RSNews Hub <no-reply@yoursite.com>`. Required alongside `RESEND_API_KEY`. |
| `SENTRY_DSN` | optional | Turns on Sentry error forwarding (see §3b). Unset → errors go to structured logs only. |

> Both email and error-tracking are **safe when unset** — the app degrades to
> logging, never to a crash or an accidental send. `/api/health` reports the
> active mode for each (`email: log-only|configured`, `errorTracking: logs-only|sentry`).

### 3a. Enable email  **[1 step: provision + set 2 vars]**

Email is wired turnkey via `src/lib/email.ts` (a welcome mail already sends on
register). It uses [Resend](https://resend.com)'s REST API — no SDK:

1. Create a Resend account, verify your sending domain, grab an API key.
2. Set `RESEND_API_KEY` and `EMAIL_FROM`. That's it — messages now send.

To use Postmark/SES instead, edit the single `deliver()` function in
`src/lib/email.ts`; every call site stays the same.

### 3b. Enable Sentry (error tracking)  **[1 line of code + 1 var]**

Errors already funnel through `captureError()` (`src/lib/logger.ts`) and are
written as structured JSON logs regardless. To also ship them to Sentry:

1. `npm install @sentry/nextjs` and add `SENTRY_DSN` to your env.
2. In your Sentry init (or any startup module), register the forwarder **once**:

   ```ts
   import * as Sentry from '@sentry/nextjs';
   import { setErrorForwarder } from '@/lib/logger';
   Sentry.init({ dsn: process.env.SENTRY_DSN });
   setErrorForwarder((e, ctx) => Sentry.captureException(e, { extra: ctx }));
   ```

No call-site changes are needed — every existing `captureError` and error
boundary begins reporting automatically.

---

## 4. Create the schema (migrations)  **[automated: scripts + init SQL]**

This project now uses **Prisma Migrate** (not `db push`). Against your Postgres
database, create the first migration once:

```bash
export DATABASE_URL="postgresql://…"   # your DB
npx prisma migrate dev --name init     # generates prisma/migrations/…, applies it
git add prisma/migrations && git commit -m "Add initial Postgres migration"
```

On the server, every deploy runs migrations non-interactively:

```bash
npm run db:migrate:deploy              # = prisma migrate deploy
```

_(The Dockerfile already runs `migrate deploy` on start. For Vercel/Railway, add
it as a build/release step — see Step 6.)_

---

## 5. Seed the admin + starter content  **[automated: env-driven, prod-safe]**

```bash
SEED_ADMIN_EMAIL="you@company.com" SEED_ADMIN_PASSWORD="a-strong-password" npm run db:seed
```

This creates categories, sample articles, ads, comics, polls, the RS Council
column, and your **admin account**. Optional demo analytics: `npm run db:seed:analytics`.
> In production the seed **throws** unless `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`
> are set — so you can never accidentally ship the public demo login.

---

## 6. Deploy the app

### Option A — Railway  *(recommended)*
1. New Project → **Deploy from GitHub repo** → pick this repo.
2. **+ New → Database → PostgreSQL.** Railway sets `DATABASE_URL` automatically.
3. Project **Variables** → add `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
4. Settings → **Deploy** → set the **Start Command** to:
   `npm run db:migrate:deploy && npm run start`
5. Deploy. Then run the seed once from Railway's shell (Step 5).

### Option B — Vercel + Neon/Supabase
1. Create a Postgres DB on Neon/Supabase → copy its connection string.
2. Import the repo into Vercel. Add env vars from Step 3 (`DATABASE_URL` = that string).
3. Vercel → **Settings → Build & Development** → set the **Build Command** to:
   `prisma migrate deploy && next build`  *(so migrations run on each deploy)*.
4. Deploy, then run the seed once (locally with the prod `DATABASE_URL`, or a one-off).

### Option C — Docker (Render / Fly.io / VPS)  **[automated: `Dockerfile`]**
```bash
docker build -t rsnews-hub .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e AUTH_SECRET="$(openssl rand -base64 48)" \
  rsnews-hub
```
The image runs `prisma migrate deploy` then starts the server. Seed once (Step 5).

---

## 7. Domain, TLS, health

- Point your domain at the host; all three options provide **automatic HTTPS**.
- **Health check:** `GET /api/health` returns `200` + a config report when the DB
  is reachable, `503` when it isn't. Point your host's health check at it.

---

## 8. Post-deploy checklist

- [ ] `GET /api/health` returns `{"status":"ok","db":"up"}` and `config.authSecret` is `set`.
- [ ] Log in at `/login` with your seeded admin — then **change the password** in the admin.
- [ ] Open the homepage, an article, and `/admin/analytics`; confirm no errors.
- [ ] Set up **automated Postgres backups** (every managed host has a toggle).
- [ ] (Optional) wire error tracking (Sentry) and email (Resend/Postmark) — see `NOTES_FOR_PROGRAMMER.md §2`.

---

## 9. The static preview (GitHub Pages)

`docs/` is served by GitHub Pages straight from the repo — no backend. To
regenerate it after content changes: `npm run build:static` (reads the local DB,
writes `docs/data.js`), then commit. If you don't want a public demo, disable
Pages in the repo settings.

---

## 10. Shipping updates & rollback

- **Update:** push to `main`; the host rebuilds. If you changed the schema, create
  a migration first (`npm run db:migrate -- --name your_change`) and commit it —
  `migrate deploy` applies it on release.
- **Rollback:** redeploy the previous commit/build in your host's dashboard.
  Migrations are forward-only; write a new migration to undo a schema change.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login always fails in prod | `AUTH_SECRET` is unset/weak — set a 24+ char random value and redeploy. |
| Build error importing Prisma | `DATABASE_URL` not set at build. Set it (any valid Postgres URL); the app connects at runtime. |
| `migrate deploy` says "no migration found" | Commit `prisma/migrations/` from Step 4. |
| Seed refuses to run | You're in production without `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` — set them. |
| Health check 503 | DB unreachable — check `DATABASE_URL`, network rules, and that the DB is running. |
