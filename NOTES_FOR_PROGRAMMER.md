# Notes for the Programmer — RSNews Hub

> **Purpose.** A running list of everything that needs a human developer / infra
> to take this from the current build to live on the real RSNews Hub site. We
> add to it as we build. Near completion we'll review it together, do whatever
> we can ourselves, and turn the rest into a concrete step-by-step for the dev.
>
> **Legend:** ✅ done · 🔵 Claude can do this in-repo · 🟠 needs a developer/infra ·
> ❓ open question for the team
>
> _Last updated: 2026-08-04 (v0.27.0)_

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

| # | Item | Status | Who |
|---|------|--------|-----|
| 1 | **Host the app on a Node server** (Vercel / Railway / Render / Fly). GitHub Pages only serves the static `docs/` preview — it can't run the admin, accounts, APIs, or poll/quiz submissions. | 🟠 | dev/infra |
| 2 | **Move off SQLite to a hosted database** (Postgres). `dev.db` is a local file and won't persist real data in production. | 🟠 | dev/infra provisions; 🔵 Claude can switch the Prisma datasource + regenerate |
| 3 | **Set real environment secrets** — `DATABASE_URL` and `AUTH_SECRET`. ⚠️ `AUTH_SECRET` currently falls back to a hard-coded dev value in `src/lib/auth.ts`; **must** be set to a strong secret in prod or sessions are forgeable. | 🟠 | dev/infra |
| 4 | **Change the seeded admin login** `admin@rsnews.local` / `admin123` (see `prisma/seed.ts`). | 🟠 | dev |
| 5 | **Adopt Prisma migrations** — the project currently uses `prisma db push` (no migration history). Switch to `prisma migrate` so schema changes apply safely to live data. | 🔵 Claude can generate the initial migration · 🟠 dev runs it against prod |
| 6 | **Confirm how the `docs/` preview is deployed** (Pages from branch `/docs`?) and whether it should stay public. | 🟠 | dev |

---

## 2. Should-have (soon after launch)

| # | Item | Status | Who |
|---|------|--------|-----|
| 7 | **Real asset storage** for comic + ad images (S3 / R2 / Cloudinary). Currently stored as data URLs or files in `/public`; won't scale. | 🔵 Claude can wire an upload adapter · 🟠 dev provisions bucket |
| 8 | **Automate image optimization** — comic/ad images are currently hand-optimized (Pillow) during authoring. | 🔵 Claude · 🟠 dev decides pipeline |
| 9 | **Email delivery** for subscriptions (they exist as data; nothing sends yet). Needs a provider (Resend / Postmark / SES). | 🟠 dev provisions · 🔵 Claude wires it |
| 10 | **Error tracking + logging** (e.g. Sentry). Production errors are currently invisible. | 🟠 dev provisions · 🔵 Claude wires it |
| 11 | **SEO/ops basics** — sitemap, robots, metadata, domain/DNS/TLS, CDN/caching. | 🟠 dev |
| 12 | **Content moderation** for any future user-generated input surfaces. | 🟠 dev |

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
- **Env vars:** `DATABASE_URL` (required), `AUTH_SECRET` (required in prod — has
  an insecure dev fallback).
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
