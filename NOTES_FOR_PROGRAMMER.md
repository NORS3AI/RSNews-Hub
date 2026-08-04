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

## 0. Architecture — how the hub relates to the RS News site

**Resolved:** the hub is a **gated area of the existing RS News website**, not a
standalone app. Members log in on the website (accounts already exist there);
being a logged-in member unlocks the hub. **The hub does not run its own
signup/login in production** — the site hands it a verified member identity and
the hub keys all its own state (poll votes, quiz answers, clippings, favorites,
reading, analytics) to that account id.

- ✅ **Auth integration seam built** _(v0.37.0)_ — one integration point,
  `src/lib/identity/`, with `AUTH_MODE` = `local` (dev/standalone, the hub's own
  login) | `jwt` (parent site signs a token — recommended) | `header` (trusted
  proxy). A local mirror `User` is provisioned per member on first visit. The
  hub's `/login` + `/register` are auto-disabled in the delegated modes. **Full
  wiring guide for your site: [`INTEGRATION.md`](./INTEGRATION.md).**
- 🟠 The one thing your side provides: a verified account id per request (plus a
  few optional attributes). See INTEGRATION.md — it's a small change on the site.
- ✅ **Per-account saved state** _(v0.38.0)_ — favorites, to-read (pinned), and
  saved clippings are stored server-side per member (`SavedItem` + `Clipping`
  tables, `/api/saved`), so they follow a signed-in member across devices.
  Anonymous visitors stay local-only; a member's pre-login local items are merged
  into their account on first sign-in. History stays local (ephemeral UI; reading
  is also logged via `ReadingLog`). `StarProvider` is local-first (instant) with
  the server as source of truth. See §3.

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
| 8 | ✅ **Dependency security — `npm audit` is clean (0 vulnerabilities).** Upgraded to **Next 15** + **React 19** (v0.34.0) and pinned Next's bundled `sharp`/`postcss` to patched versions via `overrides`. | ✅ done |

> **Security posture (v0.34.0):** `npm audit` reports **0 vulnerabilities**.
> Path taken: **Next 14 → 15.5.22** + **React 18 → 19** (the async-request-API
> migration — `cookies()`/`params`/`searchParams` are now awaited), the unused
> **Next image optimizer disabled** (`images.unoptimized`; the app uses plain
> `<img>`), **postcss** on patched 8.5.x, **vitest 3.2.7** (patched esbuild), and
> npm **`overrides`** (`sharp`/`postcss` → `$`-refs) so Next's *internally
> bundled* copies dedupe onto the patched versions too. Staying on the mature
> **15.5.x** line rather than bleeding-edge 16 — the overrides make 16 unnecessary
> for a clean audit. When you eventually move to 16, drop the overrides and
> re-audit.

---

## 2. Should-have (soon after launch)

| # | Item | Status | Who |
|---|------|--------|-----|
| 7 | ✅ **Real asset storage** — pluggable upload pipeline (`src/lib/storage/`). Images now upload to `/api/uploads` and are stored by URL, not inline base64. Local disk by default (zero config); S3/R2 via env, no code change. See §3. | ✅ done · 🟠 dev provisions bucket for cloud |
| 8 | ✅ **Automated image optimization** — uploads are auto-oriented, metadata-stripped, downscaled and re-encoded to WebP on the way in (`src/lib/storage/optimize.ts`, via sharp). No more hand-optimizing. See §3. | ✅ done |
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
- ✅ **Retention + rollups** _(v0.35.0)_ — nightly job (`src/lib/analytics/rollup.ts`)
  pre-aggregates each UTC day into an `AnalyticsDaily` row and prunes raw events
  past `ANALYTICS_RETENTION_DAYS` (default 365; 0 = keep all). History survives
  in the rollups. Powers a new **Trends** section on the dashboard (pageviews,
  visitors/day, opens, ad CTR sparklines). Trigger: `POST /api/analytics/rollup`
  (host cron with `CRON_SECRET`, or the admin **Rebuild rollups** button). Pure
  aggregation is unit-tested. See DEPLOYMENT.md §3d.
- ✅ **Audience segmentation** _(v0.36.0)_ — `src/lib/analytics/audience.ts`: the
  dashboard has an **Audience** section that segments engagement (visitors,
  sessions, pageviews, opens, opens/session) by **account type** (member/vendor/
  staff), **tenure** (from signup date), **signed-in vs guest**, **device**,
  **region**, or **store type**. Account facets live on the `User` model and are
  editable per user in admin; anonymous traffic segments as "Guest". Pure engine
  unit-tested. _(As real members sign up and get tagged, the member/region/store
  splits populate; device/tenure/auth work immediately.)_
- 🔵 **Video-ad quartiles** — the last open phase-2 item. Not externally blocked:
  it needs a **video ad format** built first (video creative on `Ad` + a player
  that fires 25/50/75/100 % + mute/autoplay events), then the quartile report.
  Buildable in-repo whenever the video-ad format is wanted.

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
- ✅ **Real asset storage (image uploads)** — `src/lib/storage/` is a pluggable
  upload pipeline. Admin image pickers now POST files to `POST /api/uploads`
  (admin-only) and store the **returned URL**, not inline base64 — so rows stay
  small and the 1MB server-action body limit is never hit. **Safe-by-default:**
  local disk (`UPLOAD_DIR`, served at `/uploads/...`) works with zero config;
  set the `S3_*` env vars to switch to AWS S3 / Cloudflare R2 with no code change
  (SigV4 signed by hand — no AWS SDK, matching the email pattern). Keys are
  **content-addressed** (sha256 → automatic dedup + immutable `cache-forever`).
  Uploads are validated by **magic-byte sniffing** (never the client MIME; SVG
  gated off), size-capped (`UPLOAD_MAX_MB`, default 8). Existing data-URLs and
  pasted URLs keep working. Health check reports the mode. Adding Cloudinary/GCS
  is one file implementing `StorageAdapter`. Unit-tested (sniff, keygen, SigV4 vs
  an independent reference, local round-trip) + verified end-to-end. _(v0.32.0)_
- ✅ **Automated image optimization** — `src/lib/storage/optimize.ts` runs inside
  the upload pipeline (before hashing/storing) using **sharp**. Every uploaded
  raster image is auto-oriented from EXIF, **metadata-stripped (incl. GPS)**,
  downscaled to `IMAGE_MAX_DIM` (default 2000px) and re-encoded to `IMAGE_FORMAT`
  (default WebP) — verified end-to-end: a 3000×2000 PNG stored as a 2000×1333
  WebP ~79% smaller. Animated GIFs/SVGs pass through; if sharp is unavailable or a
  decode fails, the **original is stored** (uploads never break). Never stores a
  result larger than the source. Tunable/​disable-able via `IMAGE_*` env; health
  check reports the mode. sharp is bundled into the standalone output. Pure policy
  helpers + a real sharp transform are unit-tested. _(v0.33.0)_
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

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma · Tailwind. DB is
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
`QuizOption` + `QuizResponse`, `IndustryLink`, `Ad`, `AnalyticsEvent`,
`AnalyticsDaily` (rollups), `SavedItem` + `Clipping` (per-account saves), plus a
`Setting` row for the homepage layout. See `prisma/schema.prisma`.

---

## 5. Decisions log (context for choices already made)

- **Pop Quiz reveal:** on submit, readers get a thank-you only; correct answers
  are stored server-side and **never sent to the client**, to be revealed later
  in a reflection article. Admin sees the full response breakdown.
- **Submission access:** login required (site is going behind a login wall);
  one submission per account.
- **Static preview:** intentionally kept as an open, interactive demo — not
  gated — because Pages has no backend.
