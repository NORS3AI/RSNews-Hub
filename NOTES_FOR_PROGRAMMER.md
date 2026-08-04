# Notes for the Programmer — RSNews Hub

> **Purpose.** A running list of everything that needs a human developer / infra
> to take this from the current build to live on the real RSNews Hub site. We
> add to it as we build. Near completion we'll review it together, do whatever
> we can ourselves, and turn the rest into a concrete step-by-step for the dev.
>
> **Legend:** ✅ done · 🔵 Claude can do this in-repo · 🟠 needs a developer/infra ·
> ❓ open question for the team
>
> _Last updated: 2026-08-04 (v0.30.0)_

---

## 0. The one big open question

- ❓ **Is this repo the live site, or a feature to port into an existing site?**
  Everything here is a complete Next.js app (homepage, admin, accounts, articles,
  polls, comics, quiz). If RSNews Hub already runs on a different platform, the
  new pieces (Pop Quiz, poll, clippings, etc.) need to be **integrated into that
  codebase**, and the data models below need to be created in the real database.
  The programmer needs to confirm which path we're on — it changes most of the
  steps below.

---

## 1. Must-do before going live (blockers)

> 📘 **Full walkthrough: [`DEPLOYMENT.md`](./DEPLOYMENT.md)** — copy-paste steps for
> Railway / Vercel+Neon / Docker. Most of the code work below is now **done**;
> the dev mainly provides credentials and clicks deploy.

| # | Item | Status | Who |
|---|------|--------|-----|
| 1 | **Host the app on a Node server** (Railway / Vercel / Render / Fly). GitHub Pages only serves the static `docs/` preview. | 🟠 dev picks a host — steps in DEPLOYMENT.md (+ `Dockerfile`, standalone output ready). |
| 2 | **Move off SQLite to a hosted database** (Postgres). | ✅ **Turnkey** — schema is Postgres-ready, init SQL generated (`deploy/init.postgres.sql`), 1-line provider switch documented. 🟠 dev provisions the DB. |
| 3 | **Set real environment secrets** — `DATABASE_URL`, `AUTH_SECRET`. | ✅ **Enforced in code** — `src/lib/env.ts` refuses weak/placeholder `AUTH_SECRET` in prod (login 500s, `/api/health` flags it). 🟠 dev sets the values. |
| 4 | **No default admin login in prod.** | ✅ **Done** — seed reads `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` and **refuses to run in production** without them. 🟠 dev sets them. |
| 5 | **Adopt Prisma migrations** (was `db push`). | ✅ **Ready** — `db:migrate` / `db:migrate:deploy` scripts + init SQL; DEPLOYMENT.md Step 4. 🟠 dev runs `migrate dev --name init` against Postgres once. |
| 6 | **Confirm `docs/` preview deploy** (Pages) & whether it stays public. | 🟠 dev — covered in DEPLOYMENT.md §9. |
| 7 | **Health check** for the host. | ✅ **Done** — `GET /api/health` (DB up/down + config report). |

---

## 2. Should-have (soon after launch)

| # | Item | Status | Who |
|---|------|--------|-----|
| 7 | **Real asset storage** for comic + ad images (S3 / R2 / Cloudinary). Currently stored as data URLs or files in `/public`; won't scale. | 🔵 Claude can wire an upload adapter · 🟠 dev provisions bucket |
| 8 | **Automate image optimization** — comic/ad images are currently hand-optimized (Pillow) during authoring. | 🔵 Claude · 🟠 dev decides pipeline |
| 9 | ✅ **Email delivery** — wired turnkey (`src/lib/email.ts`). Safe-by-default: logs (redacted) until a provider is set. Dev just sets `RESEND_API_KEY` + `EMAIL_FROM`. See §3. | ✅ done · 🟠 dev provisions provider |
| 10 | ✅ **Error tracking + logging** — structured logs + one capture chokepoint (`src/lib/logger.ts`) wired at every error site. Sentry is a one-line activation. See §3. | ✅ done · 🟠 dev provisions Sentry (optional) |
| 11 | ✅ **SEO basics** — `robots.ts`, `sitemap.ts` (dynamic, from published content), per-article canonical + Open Graph/Twitter metadata. Domain/DNS/TLS/CDN remain 🟠 dev. | ✅ done · 🟠 dev does DNS/TLS/CDN |
| 12 | **Content moderation** for any future user-generated input surfaces. | 🟠 dev |
| 13 | **Analytics phase 2+** — see the roadmap just below. | 🔵 Claude can extend · 🟠 dev sizes the DB |

### Analytics roadmap (phase 2+)

The v1 pipeline (§3) already captures the events; these are additions on top of it.

- ✅ **Exportable + sortable reports** _(v0.29.0)_ — every dashboard table has
  **click-to-sort** headers and a one-click **Export CSV** (`ReportTable` +
  `src/lib/analytics/csv.ts`). Still 🔵 open: a saved report-builder and
  scheduled email exports.
- ✅ **Advertiser-specific reports** _(v0.29.0)_ — `/admin/analytics/advertisers`:
  pick a vendor → totals + top creatives + by-placement + daily trend, each
  exportable, **scoped to that brand only** (verified no cross-brand leak). This
  is delivery option (a): the admin views/exports and hands it over. Still 🟠
  open if wanted: option (b), a real **advertiser login** with a filtered
  read-only dashboard (needs an advertiser↔brand mapping + access control).
- 🔵 **Video-ad quartiles** (25/50/75/100 %, muted/unmuted, autoplay vs click) —
  once video ads exist.
- 🔵🟠 **Audience segmentation** — break reports down by member vs vendor, store
  type, region, tenure — needs member/account data wired in.
- 🟠 **Retention + rollups** — the v1 dashboard aggregates raw rows in memory over
  a capped window. At scale, add nightly rollup tables + an event-retention
  policy so reports stay fast.

---

## 3. Already handled (so the dev doesn't redo it)

- ✅ **Abuse/rate limiting for polls & quizzes.** Submissions are login-gated and
  limited to **one per account**, enforced by DB unique constraints (`PollVote`,
  `QuizResponse (quizId,userId)`), not just client-side. Routes return
  401 (anon) / 409 (duplicate). _(v0.26.0)_
- ✅ **Automated tests** — Vitest suite (37 tests): pure logic + API-route tests
  that lock the auth/one-per-account behavior. Run `npm test`. _(v0.26.0)_
- ✅ **CI** — GitHub Actions (`.github/workflows/ci.yml`): install → prisma
  generate → type-check → test → build, on every PR and push to main. _(v0.26.0)_
- ✅ **Smart in-article ads** — competitor ads are suppressed inside articles
  (`src/lib/ads.ts`), covered by tests.
- ✅ **Analytics pipeline v1** — a generic `AnalyticsEvent` table + ingestion API
  (`/api/analytics/collect`, sendBeacon) + client tracker (`src/lib/analytics/*`,
  `AnalyticsProvider`) capturing viewable impressions (dwell + above-fold),
  clicks, article reads (active time + scroll depth), clippings funnel, and
  search. Admin dashboard at `/admin/analytics` frames Exposure→Interaction→
  Outcome with "compare by" splits. Separate campaign/creative/placement ids on
  ads. Pure aggregation is unit-tested. _(v0.28.0)_
- ✅ **Error tracking + structured logging** — `src/lib/logger.ts` is the single
  error chokepoint: `captureError(err, ctx)` always writes a structured JSON log
  line (never secrets) **and** forwards to an optional sink. It's already wired
  at the risky sites (API route catches, route + global React error boundaries in
  `error.tsx` / `global-error.tsx`). **Sentry is a one-liner** — install
  `@sentry/nextjs` and add `setErrorForwarder((e, ctx) => Sentry.captureException(e, { extra: ctx }))`
  once at startup; no call-site changes. Health check reports the mode
  (`logs-only` / `sentry`). Unit-tested. _(v0.31.0)_
- ✅ **Transactional email** — `src/lib/email.ts`, provider-agnostic and
  **safe-by-default**: with no provider it **logs** (redacted recipient) instead
  of sending, so nothing goes out by accident. Set `RESEND_API_KEY` + `EMAIL_FROM`
  to actually send (Resend REST API, no SDK; swap the one `deliver()` fn for
  Postmark/SES). Validates recipients, never throws, returns a result. A welcome
  email is already sent on register (best-effort). Unit-tested. _(v0.31.0)_
- ✅ **SEO basics** — dynamic `robots.txt` (blocks `/admin`, `/api`, auth pages)
  and `sitemap.xml` (`src/app/robots.ts` / `sitemap.ts`, built live from published
  articles/categories/tags/pages). Per-article `generateMetadata` emits a
  canonical URL + Open Graph (`type:article`, cover image, publish time) + Twitter
  card. Set `SITE_URL` in prod so URLs are absolute. _(v0.31.0)_
- ✅ **Configurable homepage modules** — every module type (feature showcase,
  RS Council column, comics, poll, quiz, carousels, ads, etc.) is add/reorder/
  lock/hide-able from **Admin → Homepage layout** (`src/lib/homepage.ts` catalog).
  Configurable modules also expose an admin **source** picker (e.g. the feature
  showcase can pull from Featured / Latest / Trending). _(v0.27.0)_
- ⚠️ **Demo cover images** in `public/covers/` are generated placeholders
  (Pillow). Real editorial covers are uploaded per-article in the article editor;
  this ties into the "automate image optimization" item above.

---

## 4. Repo facts & gotchas the dev needs to know

- **Stack:** Next.js 14 (App Router) · TypeScript · Prisma · Tailwind. DB is
  SQLite in dev (`prisma/schema.prisma`, `DATABASE_URL=file:./dev.db`).
- **Env vars:** see `.env.example`. `DATABASE_URL` + `AUTH_SECRET` required in
  prod (validated in `src/lib/env.ts` — a weak `AUTH_SECRET` is rejected at
  runtime, not silently accepted). Admin seed needs `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` in prod. Full deploy: `DEPLOYMENT.md`.
- **Two front-ends in one repo:**
  - `src/` — the real Next.js app (dynamic, DB-backed).
  - `docs/` — a **static** snapshot for the GitHub Pages preview (`app.js`,
    `styles.css`, `index.html`, generated `data.js`). Built by
    `scripts/build-static.mjs` (`npm run build:static`). It has **no backend or
    login**, so interactive features there (poll/quiz) are localStorage demos
    only. Don't confuse it with production behavior.
- **Version badge** lives in the footer in two places: `docs/index.html` and
  `src/lib/constants.ts` (kept in sync on each shipped change).
- **Data collected by new features:** quiz responses + poll votes (low
  sensitivity). Accounts already existed on the site, so this feature does **not**
  introduce new account/PII collection.

### New database models added this project (must exist in the prod DB)
`Comic`, `Poll` + `PollOption` + `PollVote`, `Quiz` + `QuizQuestion` +
`QuizOption` + `QuizResponse`, `IndustryLink`, `Ad`, plus a `Setting` row for the
homepage layout. See `prisma/schema.prisma`.

---

## 5. Decisions log (context for choices already made)

- **Pop Quiz reveal:** on submit, readers get a thank-you only; correct answers
  are stored server-side and **never sent to the client**, to be revealed later
  in a reflection article. Admin sees the full response breakdown.
- **Submission access:** login required (site is going behind a login wall);
  one submission per account.
- **Static preview:** intentionally kept as an open, interactive demo — not
  gated — because Pages has no backend.
