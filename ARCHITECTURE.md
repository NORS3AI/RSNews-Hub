# Architecture

A map of the RSNews Hub codebase for anyone picking it up. It aims to answer
"where does X live?" and "why is it shaped this way?" in a few minutes.

> **Companion docs:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) (ship it),
> [`INTEGRATION.md`](./INTEGRATION.md) (connect it to the RS News site),
> [`NOTES_FOR_PROGRAMMER.md`](./NOTES_FOR_PROGRAMMER.md) (running status + decisions).

## What it is

RSNews Hub is a **gated area of the RS News website** — a reader/member
experience (articles, comics, polls, a pop quiz, clippings, recommendations) plus
an admin console and an analytics suite. In production it does **not** run its own
login: the website authenticates members and hands the hub a verified identity
(see *Identity delegation* below). Standalone/dev mode has its own login so the
whole thing runs and tests in isolation.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma ·
SQLite (dev) / Postgres (prod) · Tailwind. Tests: Vitest. CI: GitHub Actions.

## The two codebases

| | Path | What it is |
|---|---|---|
| **The app** | `src/` + `prisma/` | The real product — the Next.js application. |
| **The preview** | `docs/` | A standalone vanilla-JS site for GitHub Pages. |

They're linked by `scripts/build-static.mjs`, which reads the **same Prisma
database** and writes `docs/data.js` (a snapshot of published content). So the
static preview is *generated from the app's data* — its HTML/CSS/JS shell is
fixed and just renders that snapshot. Editing `docs/*.html` by hand is only for
the shell, never content.

## Directory layout

```
src/
  app/                     Next.js App Router
    (site)/                public + member site (route group)
      docs/                the reader experience, served under /docs
        article/[slug]/  category/[slug]/  tag/[slug]/  page/[slug]/
        search/  clippings/  history/  subscriptions/  archive/*
      login/  register/  account/  layout.tsx
    admin/                 admin console (articles, users, ads, analytics, …)
    api/                   route handlers (see below)
    robots.ts  sitemap.ts  error.tsx  global-error.tsx  layout.tsx  globals.css
  middleware.ts            edge middleware (assigns the anonymous reader id)
  components/
    site/                  reader client components (StarProvider, AnalyticsProvider,
                           ClippingsList, PollCard, QuizCard, ArticleModalProvider, …)
    admin/                 admin UI (ArticleEditor, ReportTable, Sparkline, …)
  lib/                     all business logic (see "The lib layer")
prisma/    schema.prisma · seed.ts · dev.db
scripts/   build-static.mjs (generates docs/data.js) · seed-analytics.mjs
deploy/    init.postgres.sql
docs/      static GitHub Pages preview (generated data + static shell)
```

### API routes (`src/app/api`)
`auth/{login,logout,register}` · `saved` (per-account favorites/clips) ·
`reading` · `subscriptions` · `search` · `polls/[id]/vote` ·
`quizzes/[id]/submit` · `articles/[slug]` · `industry/[id]/go` (click-through) ·
`uploads` (admin image upload) · `analytics/{collect,rollup}` · `health`.

## The lib layer (`src/lib`)

Business logic lives here so routes/components stay thin. One line each:

| Module | Responsibility |
|---|---|
| `db.ts` | Prisma client singleton (cached in dev). |
| `auth.ts` | Sessions (JWT via `jose`), bcrypt hashing, `getCurrentUser`/`requireAdmin`; delegates to the identity seam. |
| `actions.ts` | `'use server'` admin write actions (articles, users, homepage, analytics rollup…). |
| `constants.ts` | String-enum sources of truth (roles, statuses, account types) — SQLite has no enums. |
| `env.ts` | Centralized, validated env access; fails loud only at runtime-in-prod; `envReport()` powers `/api/health`. |
| `email.ts` | Provider-agnostic transactional email; **logs instead of sending** when unconfigured. |
| `logger.ts` | Structured logging + one `captureError` chokepoint with a pluggable forwarder (Sentry = one line). |
| `moderation.ts` | Pure, reusable user-text moderation (`moderateText` → ok/flag/block). The gate for any user-generated text. |
| `homepage.ts` | Homepage module catalog + admin-arranged layout (stored as JSON in `Setting`). |
| `ads.ts` / `adsServer.ts` | Pure smart-ad selection (competitor suppression, relevance) / DB inventory loader. |
| `recommend.ts` | Article recommendations + `smartSearch`. |
| `quiz.ts` | Pure quiz helpers (parse admin input, `isQuizOpen`, `validateAnswers`). |
| `saved.ts` | Per-account favorites / to-read / clippings: pure input normalizers + Prisma writes. |
| `queries.ts` · `industry.ts` · `utils.ts` | Shared select shapes/mappers · industry-links helpers · slugify/excerpt/dates. |
| `quoteImage.ts` · `uploadClient.ts` | Client-only: clipping quote-card canvas · image-upload fetch helper. |
| **`identity/`** | The auth-delegation **seam**: `index.ts` (pick provider by `AUTH_MODE`, provision mirror `User`), `jwt.ts`, `header.ts`, `types.ts`. |
| **`storage/`** | Pluggable asset storage: `index.ts` (`putImage`), `local.ts`, `s3.ts` (+`sigv4.ts`, no SDK), `sniff.ts` (magic-byte validation), `optimize.ts` (sharp). |
| **`analytics/`** | `track.ts`/`record.ts` (client + ingest), `query.ts` (the only DB reads), and pure `metrics.ts`/`audience.ts`/`rollup.ts`/`csv.ts`. |

## Cross-cutting patterns

These recur on purpose — learn them once and the codebase is predictable.

1. **Safe-by-default provider seams.** `email`, `storage`, and `identity` each
   have one swappable implementation chosen by env, with a safe default that
   needs zero config: email *logs* instead of sending; storage writes to *local
   disk*; auth uses the hub's *own login*. Flip an env var (and, for Sentry, add
   one line) to go to the real backend — no call-site changes.

2. **Pure core + thin I/O.** The logic that's worth testing is kept free of the
   database and framework: `analytics/metrics|rollup|audience|csv`, `ads`,
   `quiz`, `saved` normalizers, `storage/sniff|sigv4|optimize`, `moderation`.
   The DB-touching shells around them (`analytics/query`, `record`, route
   handlers) stay small. This is why the test suite is fast and meaningful.

3. **Env centralization + a health check.** All config goes through `env.ts`;
   nothing else reads `process.env` for secrets. `envReport()` surfaces the live
   configuration (db, auth mode, email/storage/error-tracking status) at
   `GET /api/health` so ops can confirm a deploy at a glance.

4. **Identity delegation (`AUTH_MODE`).** In production the hub trusts the parent
   site's verified member and provisions a local *mirror* `User` keyed to
   `externalId`, so every piece of hub state (votes, quiz answers, clippings,
   favorites, reading, analytics) hangs off one stable id. See `INTEGRATION.md`.

5. **Content-addressed storage.** Uploaded images are optimized, then the storage
   key is the hash of the *optimized* bytes — automatic dedup and immutable,
   cache-forever URLs.

6. **One error chokepoint.** Every route's `catch` calls
   `captureError(e, { route })`. Structured JSON logs always; forwarding to
   Sentry is a single `setErrorForwarder(...)` with no call-site edits.

## Data model (`prisma/schema.prisma`)

Content: `Article` · `Category` · `Tag` · `ArticleTag` · `Page` · `Comic` ·
`IndustryLink` · `Ad`. Engagement (all per-account): `Poll`/`PollOption`/
`PollVote` · `Quiz`/`QuizQuestion`/`QuizOption`/`QuizResponse` · `Subscription` ·
`ReadingLog` · `SavedItem` · `Clipping`. People: `User` (with `externalId` for
the parent-site link + audience facets). Analytics: `AnalyticsEvent` (raw) +
`AnalyticsDaily` (rollups). Config: `Setting` (key/value, e.g. homepage layout).

## Testing & CI

- **Vitest** — pure cores + the two write-critical API routes (poll vote, quiz
  submit). Run `npm test`. Coverage concentrates on the logic that can be wrong:
  analytics math, storage validation/signing, quiz/ads/saved/moderation
  normalizers, and the config/email/logger seams.
- **CI** (`.github/workflows/ci.yml`) on every push to main and PR:
  `npm ci` → `prisma generate` → `prisma db push` (throwaway SQLite) →
  `typecheck` → `test` → `build`.

## Conventions

- **Business logic in `src/lib`**, not in components or route handlers.
- **Pure and testable by default** — reach for the DB/framework only in the thin
  shell around a pure function.
- **Never trust client input** — normalize/validate at the server boundary
  (`saved.ts`, `moderation.ts`, `storage/sniff.ts`, the analytics `record.ts`).
- **Read config through `env.ts`**, and surface new operational state in
  `envReport()`.
- **Add a test** next to any new pure module (`*.test.ts` beside the source).
- **Bump `APP_VERSION`** (`src/lib/constants.ts`) + the `docs/index.html` badge on
  each shipped change.
