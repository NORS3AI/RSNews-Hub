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

> The committed schema is verified to translate cleanly to Postgres —
> `prisma validate` passes and `prisma migrate diff` generates clean DDL for all
> tables against the `postgresql` provider (no SQLite-only features). What's left
> for you is running it against your provisioned instance (below).

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

### 3c. Asset storage (image uploads)  **[works with zero config]**

Comic, ad and cover images upload through `POST /api/uploads` (admin-only,
magic-byte validated, content-addressed) via `src/lib/storage/`. **Default: local
disk** — files are written under `UPLOAD_DIR` (default `./uploads`) and served at
`/uploads/...`. Nothing to configure to start.

- **Single VPS / Docker:** keep local disk, but point `UPLOAD_DIR` at a
  **persistent, writable volume** (uploads must survive redeploys; `output:
  'standalone'` means writing into `public/` at runtime is not an option). E.g.
  `-e UPLOAD_DIR=/data/uploads -v rsnews-uploads:/data/uploads`.
- **Serverless / multi-instance (Vercel, Fly with >1 machine):** local disk is
  ephemeral and not shared — use **S3 or Cloudflare R2** instead. Set:

  | Var | Example |
  |-----|---------|
  | `STORAGE_DRIVER` | `s3` (or leave unset — a set `S3_BUCKET` auto-selects S3) |
  | `S3_BUCKET` | `rsnews-assets` |
  | `S3_REGION` | `us-east-1` (R2: `auto`) |
  | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | your keys |
  | `S3_ENDPOINT` | **R2 only:** `https://<accountid>.r2.cloudflarestorage.com` |
  | `S3_PUBLIC_URL` | public/CDN base for returned links, e.g. `https://cdn.yoursite.com` |

  The bucket must be **readable at the returned URL** — either a public bucket
  policy or a CDN / R2 custom domain via `S3_PUBLIC_URL`. Uploads are signed with
  SigV4 directly (no AWS SDK dependency). No code change to switch backends;
  `/api/health` reports the active mode (`storage: local | s3`).

Other knobs: `UPLOAD_MAX_MB` (default 8), `UPLOAD_ALLOW_SVG` (default off — SVG can
carry script). To add a non-S3 backend (Cloudinary, GCS…), implement
`StorageAdapter` in one new file under `src/lib/storage/` and add a case to
`getAdapter()`.

### 3d. Analytics rollups + retention  **[optional cron]**

Analytics works with no setup, but at scale you want two things: fast trend
charts and a bounded raw-events table. Both come from the **daily rollup** job
(`src/lib/analytics/rollup.ts`):

- It pre-aggregates each UTC day into an `AnalyticsDaily` row (powers the
  **Trends** section of `/admin/analytics`).
- It then prunes raw `AnalyticsEvent` rows older than `ANALYTICS_RETENTION_DAYS`
  (default **365**; set `0` to never prune). History survives in the rollups.

Trigger it nightly by having your host's scheduler POST the endpoint with the
shared secret:

```bash
curl -X POST https://YOURSITE/api/analytics/rollup \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in your env. On Vercel add a `vercel.json` cron; on
Railway/Render use a scheduled job; or use any external cron. Admins can also
click **Rebuild rollups** on the analytics page at any time (no secret needed —
it uses the admin session). The job is idempotent and re-rolls the last few days
to catch late-arriving events.

Add a **second nightly cron** for ad-campaign upkeep (same `CRON_SECRET`) — it
ends elapsed ad flights, completes finished campaigns, and **sends vendor reminder
emails** (fresh-ads + renewal, when `RESEND_API_KEY`/`EMAIL_FROM` are set). Ad
takedown itself is automatic (serving respects each flight's window), so this is
bookkeeping + reminders:

```bash
curl -X POST https://YOURSITE/api/ads/maintenance -H "Authorization: Bearer $CRON_SECRET"
```

**Don't want to configure a host scheduler?** A ready-made GitHub Action —
`.github/workflows/nightly.yml` — hits both endpoints on a daily schedule.
Just add two repo secrets (`PROD_URL`, `CRON_SECRET`) and it runs; without
`PROD_URL` it no-ops. (Prefer your host's native cron if it has one.)

**Image optimization** is automatic (via `sharp`, a dependency). On upload,
images are auto-oriented, **stripped of metadata (including GPS)**, downscaled to
`IMAGE_MAX_DIM` (default 2000px longest edge) and re-encoded to `IMAGE_FORMAT`
(default WebP) — so a heavy phone photo becomes a small, right-sized asset before
storage. Animated GIFs and SVGs pass through untouched, and if `sharp` can't load
the **original is stored unchanged** (uploads never fail). Tune with
`IMAGE_OPTIMIZE` / `IMAGE_FORMAT` / `IMAGE_MAX_DIM` / `IMAGE_QUALITY`, or set
`IMAGE_OPTIMIZE=false` to disable. `sharp` is bundled into the standalone output;
no extra install step. `/api/health` shows the active setting.

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
- **Health check:** `GET /api/health` returns `200` when the DB is reachable,
  `503` when it isn't. The detailed `config` block is only returned to a
  logged-in **admin** (so an anonymous caller can't read your posture) — point
  your host's health check at the plain `status`/`db` fields.

---

## 7a. Security notes  **[hardening is built-in; a few operator knobs]**

The app ships hardened by default; a pre-launch audit's findings are all fixed.
What you should know as the operator:

- **Secrets must be strong.** Both `AUTH_SECRET` and (when `AUTH_MODE=jwt`)
  `PARENT_JWT_SECRET` are **rejected in production if weak/short** (< 24 chars) —
  the app fails **closed** (no one is authenticated) rather than trusting a
  brute-forceable secret. Generate with `openssl rand -base64 48`.
- **Parent tokens must expire.** The hub requires an `exp` claim and pins the
  JWT algorithm to HS256. Keep tokens short-lived (≤ 15 min); see `INTEGRATION.md`.
- **Embedding.** The hub sends a `frame-ancestors` CSP. To let the RS News site
  iframe it, set `FRAME_ANCESTORS="'self' https://www.rsnews.com"`; otherwise
  only same-origin framing is allowed (blocks clickjacking).
- **Editor content is sanitized** on save (no stored XSS), uploads are
  magic-byte-validated and served sandboxed, admin/cron endpoints are
  authenticated, and login/register are rate-limited. Prefer `AUTH_MODE=jwt`
  over `header` (header trust is only safe behind a proxy that strips inbound
  `x-member-*`).
- Baseline headers (`nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP) are
  set on every response. `npm audit` is clean.

---

## 8. Post-deploy checklist

- [ ] `GET /api/health` returns `{"status":"ok","db":"up"}` (and, when you hit it
      as a logged-in admin, `config.authSecret` is `set`).
- [ ] Log in with your seeded admin — then **change the password** in the admin
      (local auth), or confirm SSO from the RS News site (`AUTH_MODE=jwt`).
- [ ] Open the homepage, an article, and `/admin/analytics`; confirm no errors.
- [ ] Set `FRAME_ANCESTORS` if the hub is embedded in the parent site.
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
