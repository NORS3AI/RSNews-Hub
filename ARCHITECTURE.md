# Architecture — the three agnostic layers

> **The design goal.** Keep the app split into three loosely-coupled layers so the
> **interface can be replaced** — up to a fully AI-composed, per-user frontend —
> **without touching the information or the logic**. This document is the contract:
> what each layer is, where it lives, and the rules that keep them separable.
>
> _This is a north star we are converting toward, page by page, behavior-preserving.
> See the status table at the bottom for what's done._

---

## The three layers

```
┌──────────────────────────────────────────────────────────┐
│  INTERFACE   how it looks — React today, anything tomorrow │  src/app/**, src/components/**
│  depends ↓ on Information only (never reaches into Logic/DB)│
├──────────────────────────────────────────────────────────┤
│  INFORMATION what to show — typed, serializable data       │  src/lib/*Data.ts, src/lib/cards.ts
│  depends ↓ on Logic + Prisma                                │
├──────────────────────────────────────────────────────────┤
│  LOGIC       the rules — pure domain modules, no UI         │  src/lib/** (+ Prisma models)
│  depends on nothing above it                                │
└──────────────────────────────────────────────────────────┘
```

The dependency arrow only ever points **down**. A lower layer never imports an
upper one.

### Logic — the rules
Pure domain modules with **no UI and no knowledge of any page**: entitlements,
ad selection, recommendations, the Module Studio tree, analytics, moderation,
SSRF/rate-limit guards, the Prisma schema. Lives in `src/lib/**`. This layer is
already ~85% of the way there — most of it was always here.

### Information — what to show
One function per reader route — **`getXData()`** — that does all the fetching and
derivation and returns a **typed, serializable bundle** (plain data: no JSX, no
React, no class instances). Lives in `src/lib/*Data.ts` (e.g. `homepageData.ts`,
`categoryData.ts`). Shared content shapes (the article card) live in
`src/lib/cards.ts`. This layer may call Logic and Prisma freely; it may **not**
import anything from the Interface layer.

Rule of thumb: if you can't `JSON.stringify` it, it doesn't belong in a bundle
(the one deliberate exception is `Date`, which serializes fine over the RSC
boundary).

### Interface — how it looks
Pages (`src/app/**/page.tsx`) and components (`src/components/**`). They **consume
a bundle and render it**. Request-local *render* state that only exists while
drawing — an ad-rotation cursor, a "already shown" dedup set — is allowed here.
What is **not** allowed:

- **No `import { prisma }` in a reader page.** Data comes from a `getXData()`.
- **No Prisma `select` literals** in a page or component. Selects live in the
  Information layer (extend `cardSelect` with a spread; never fork it).
- **No business rules** inlined in JSX. Gating, disclosure, ranking, ad choice
  are Logic/Information decisions the view merely displays.

---

## Why this reaches the end goal (AI-composed UI)

An alternate frontend — a native app, a redesign, or an AI that composes a unique
layout per reader — only needs to call the same `getXData()` bundles. Because the
bundles are UI-agnostic data and the rules live below them, **the entire Interface
layer can be swapped and Logic/Information don't move.** Two pieces already exist
to make the wild version real:

1. **The data seam** — `getHomepageData()` proves the hardest page can hand its
   whole state to any renderer.
2. **The generic renderer** — **Module Studio** already turns a *data description
   of a layout* (a composition tree of blocks) into UI. Letting an AI emit that
   tree instead of an admin is the on-ramp, not a rewrite.

---

## The rules (enforceable)

1. A reader page/component never imports `prisma`. **Enforced automatically:**
   `src/lib/architecture.boundary.test.ts` fails the build if any reader page
   imports the DB client, and an ESLint `no-restricted-imports` override flags it
   in the editor.
2. Every reader route has a `getXData()` in `src/lib/*Data.ts` returning a typed
   bundle; `type XData = Awaited<ReturnType<typeof getXData>>`.
3. All article-list data flows through `src/lib/cards.ts` (`cardSelect` / `toCard`).
   Forking the select silently drops the derived `sponsored` flag → the
   **"Partner content" FTC disclosure** disappears. Spread to extend, never fork.
4. Reader-facing disclosure goes through `isPartnerContent()` (`ArticleBadges.tsx`)
   wherever an article title/summary is shown.

---

## Status

Every reader route now renders from a typed `getXData()` bundle and imports no
Prisma. The whole reader Information layer is re-exported from one entry point,
**`src/lib/readerData.ts`** — the single import surface for an alternate frontend.

| Reader surface | Information layer | Prisma-free page |
|---|---|---|
| Homepage | ✅ `getHomepageData()` | ✅ |
| Category · Tag · Categories index | ✅ `getCategoryData()` / `getTagData()` / `getCategoriesData()` | ✅ |
| Article reader | ✅ `getArticlePageData()` (notFound/locked/full) | ✅ |
| Archive + industry/comics/quizzes/polls | ✅ `getArchiveData()` + `get*ArchiveData()` | ✅ |
| Search | ✅ `getSearchData()` | ✅ |
| CMS static pages | ✅ `getStaticPageData()` | ✅ |
| Account | ✅ `getAccountData()` | ✅ |
| Vendor dashboard | ✅ `getVendorDashboardData()` (signedout/notvendor/full) | ✅ |

- **Shared DTO:** ✅ `cards.ts` (the article card, shared across every list).
- **Automated boundary guard:** ✅ `architecture.boundary.test.ts` + ESLint override.
- **Consolidated contract surface:** ✅ `readerData.ts` re-exports every data fn + type.
- **Swappability proof:** ✅ the **render manifest** (`manifest.ts`) turns a bundle
  into UI-agnostic JSON blocks; the generic `ManifestView` draws any manifest;
  `/docs/category/<slug>/alt` renders the same category through it (a second UI
  over one bundle), and `GET /api/render/category/<slug>` serves it as headless
  JSON for a native app or an AI-composed frontend.

## The AI-composed-UI on-ramp

The manifest is the primitive the wild goal rides on. Today a `categoryManifest()`
adapter hand-writes the block list; the same `ViewManifest` shape could instead be
**emitted by an AI** (given the bundle + a reader profile) and drawn by the very
same `ManifestView`. Module Studio already proves the composition side for the
homepage. Generalizing the manifest to every surface + adding a composer that
personalizes the block list per reader is the remaining product work — but the
architecture to support it now exists and is enforced.

_Admin tooling is intentionally out of scope — it's internal, not a surface you'd
swap or AI-compose._
