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
| 12 | ✅ **Content moderation** — reusable `moderateText` (`src/lib/moderation.ts`, pure + tested): ok/flag/block with cleaned text + reasons, env-tunable blocklist. Applied to the one persisted user-authored field today (registration name). **Note:** the hub has **no public UGC** yet (no comments/reviews); this is defense-in-depth + the ready gate for when member-authored public content is added — drop `moderateText()` in front of it. | ✅ done |
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
- ✅ **Video ads + quartiles** _(v0.40.0)_ — silent, muted, in-view autoplay
  looping video creatives (mp4/webm) in the rectangle slot (`Ad.video` +
  `videoPoster`; `VideoAd` component). Respects reduced-motion, pauses off-screen,
  click → advertiser. Reports playback quartiles (start/25/50/75/100, once per
  view) → a **watch-through funnel** on the dashboard (`aggregateVideo`, compare
  by creative/campaign/placement). Uploads accept mp4/webm via
  `/api/uploads?kind=video` (magic-byte validated, `UPLOAD_VIDEO_MAX_MB` cap).
  GIFs still work as image creatives (no quartiles). Funnel math + video-sniff
  unit-tested; upload/serve/render/ingest verified end-to-end.

---

## 3. Already handled (so the dev doesn't redo it)

- 🟠🔵 **Vendor ad-sales system** — being built in phases. **Done (v0.42.0):
  campaign scheduling backbone.** A campaign (`AdCampaign`) is a vendor's purchase,
  split into **3-month flights** (`AdFlight`): 3mo = 1 flight, 6mo = 2, 12mo = 4,
  Premium adds video, Holiday/Seasonal = a custom window — all from a flexible,
  addable plan catalog (`src/lib/adPlans.ts`), so new packages are config, not
  code. Admin (`/admin/campaigns`) assigns creatives to a flight and **Schedules
  ("Go")** it; serving (`lib/ads` — paid inventory preferred over house ads) only
  shows a flight's ads inside its window, so **takedown is automatic** at flight
  end. Nightly `POST /api/ads/maintenance` (cron/admin) ends elapsed flights,
  completes finished campaigns, and flags flights whose fresh creatives are due
  soon. **Done (v0.43.0): flexible entitlements + vendor identity + dashboard.**
  The parent SSO token may now carry `tier`, `affiliations` (array/comma list),
  and `vendorBrand` — all **free-form strings** (no hardcoded enum), parsed by
  `src/lib/entitlements.ts` (`isVendor`/`isPremium`/`hasAffiliation`/
  `meetsRequirement` for data-driven content gating; `brandKey` for matching).
  A vendor gets a self-serve **dashboard** (`/docs/vendor`, linked from Account):
  Current / History / Performance tabs showing each campaign's flights with
  live-countdown / upcoming / fresh-ads-needed / ended badges (Performance is the
  placeholder for the admin-approved quarterly reports). While a vendor browses,
  their own live ads are **surfaced first** in article slots (`favorBrand` through
  `lib/ads` → `lib/adsServer` → the article page). **Done (v0.44.0): Vendor
  entity + FK.** Campaigns and vendor accounts now resolve to a single `Vendor`
  row (unique normalized `brandKey`) instead of matching on a brand string —
  `src/lib/vendors.ts` (`findOrCreateVendor`/`vendorIdForBrand`), campaign
  creation attaches/creates the vendor, the dashboard loads campaigns by FK, and
  `scripts/backfill-vendors.mjs` links legacy rows. **Done (v0.45.0): quarterly
  performance reports.** `src/lib/reports.ts` snapshots the ad analytics we
  already collect (`advertiserReport` → impressions/viewable/clicks/CTR/dwell,
  per-creative + per-placement + daily trend) for one vendor over a calendar
  quarter; the admin (`/admin/reports`) auto-drafts, edits a summary, and
  **publishes** (only PUBLISHED reports show on the vendor Performance tab). The
  numbers are frozen into `PerformanceReport.metrics` (JSON) at generation, so a
  published report is stable as raw events age out. `scripts/seed-ad-analytics.mjs`
  seeds demo events. **Done (v0.46.0): JotForm ingestion.** A JotForm webhook
  (`POST /api/ingest/jotform`) turns each vendor submission into a DRAFT campaign
  + creatives for admin review — timing-safe secret, idempotent on the submission
  id, creatives fetched **only from JotForm hosts** (SSRF-guarded) through the
  image pipeline, raw payload kept for audit. Field mapping is data
  (`JOTFORM_FIELD_MAP`), parsing is pure/tested (`src/lib/jotform.ts`), the
  fetch/DB side is `src/lib/jotformIngest.ts`. Admin `/admin/campaigns` shows a
  review banner. **Done (v0.47.0): content gating.** `Article.requirement`
  (free-form token: `premium` | `vendor` | `staff` | `member` | an affiliation
  like `packagehub`) gates a story — enforced server-side on the article page via
  `canViewContent` (which, unlike `meetsRequirement`, denies signed-out viewers of
  gated content). Locked articles show a teaser + gate screen (no content, no view
  tracked); listings show a 🔒 badge (`requirementLabel`); the article editor has
  an **Access** field. **Next phases:** (8) renewal reminder emails (wire the email
  seam + a nightly cron hitting `/api/ads/maintenance`); (9) payment reconciliation.
- ✅ **Ad-sales security pass** _(v0.48.0)_ — adversarial review of the vendor /
  gating / JotForm surfaces. Fixes: the content gate is now enforced on **every**
  content-serving path, not just the article page — the article JSON API
  (`/api/articles/[slug]` → 403 on gated), the reading tracker
  (`/api/reading` — no view bump for content you can't see), and the RS Council
  homepage module (ungated pieces only); report **publish/unpublish is
  ADMIN-only**; JotForm ingest is now **idempotent** (once-only claim on the
  unique `submissionId` — a webhook retry can't spawn a second campaign) and
  **atomic** (vendor + campaign + creatives in one `$transaction`); creatives are
  **capped** per submission (`MAX_CREATIVES`), the raw payload is size-capped, the
  endpoint is **rate-limited**, error responses are generic (details only in the
  audit row/logs), the SSRF allowlist is tightened to JotForm-owned `.com`
  domains, and `sharp` gets an explicit `limitInputPixels`. Confirmed safe (no
  change needed): webhook auth (timing-safe, fail-closed), the core SSRF guard
  (redirect:error + punycode-anchored host match), vendor IDOR (brand not
  attacker-controlled; empty-brand → no leak), no SQL injection, no stored XSS.
- ✅ **Pre-launch security pass** _(v0.41.0)_ — full audit of auth/identity, all
  API routes, uploads, injection/XSS, secrets, headers. Fixes: editor HTML is
  **sanitized on write** (`src/lib/sanitize.ts` — no stored XSS from EDITOR-role
  accounts); `PARENT_JWT_SECRET` strength **enforced in prod** (fail-closed) and
  the parent JWT now **requires `exp`** + pins HS256; banned/suspended members
  can't act on a stale token; `/api/health` config is **admin-only**;
  `mergeLocal` bounded; **rate-limiting** on login/register (`src/lib/rateLimit.ts`);
  constant-time cron-secret compare; **security headers + CSP** (`frame-ancestors`
  runtime-configurable via `FRAME_ANCESTORS`; served uploads sandboxed). Verified
  live. `npm audit` clean. See DEPLOYMENT.md §7a. Confirmed safe: authz scoping,
  path-traversal defense, one-per-account constraints, no SSRF/SQL-injection.
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
`AnalyticsDaily` (rollups), `SavedItem` + `Clipping` (per-account saves), `Vendor` + `AdCampaign` + `AdFlight` + `PerformanceReport` + `AdSubmission` (ad sales — a
campaign now FKs to a `Vendor` by normalized `brandKey`, run `scripts/backfill-vendors.mjs` once after deploy to link legacy rows; reports are per vendor per quarter; `AdSubmission` records each JotForm webhook), plus a
`Setting` row for the homepage layout. See `prisma/schema.prisma`. `User` also
gained cached entitlement columns mirrored from the SSO token — `accountType`,
`tier`, `affiliations` (comma list), `vendorBrand`, `region`, `storeType`.

---

## 5. Decisions log (context for choices already made)

- **Pop Quiz reveal:** on submit, readers get a thank-you only; correct answers
  are stored server-side and **never sent to the client**, to be revealed later
  in a reflection article. Admin sees the full response breakdown.
- **Submission access:** login required (site is going behind a login wall);
  one submission per account.
- **Static preview:** intentionally kept as an open, interactive demo — not
  gated — because Pages has no backend.
