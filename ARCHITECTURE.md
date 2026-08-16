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

1. A reader page/component never imports `prisma`. _(Phase 3 adds an automated
   guard for this.)_
2. Every reader route has a `getXData()` in `src/lib/*Data.ts` returning a typed
   bundle; `type XData = Awaited<ReturnType<typeof getXData>>`.
3. All article-list data flows through `src/lib/cards.ts` (`cardSelect` / `toCard`).
   Forking the select silently drops the derived `sponsored` flag → the
   **"Partner content" FTC disclosure** disappears. Spread to extend, never fork.
4. Reader-facing disclosure goes through `isPartnerContent()` (`ArticleBadges.tsx`)
   wherever an article title/summary is shown.

---

## Status

| Reader surface | Information layer | Prisma-free page |
|---|---|---|
| Homepage | ✅ `getHomepageData()` | ✅ |
| Category | ✅ `getCategoryData()` | ✅ |
| Tag | ✅ `getTagData()` | ✅ |
| Search | ⛗ uses `smartSearch()` (Logic); no page bundle yet | — |
| Archive | ⛗ still fetches inline | — |
| Article reader | ⛗ still fetches inline | — |

Shared DTOs: ✅ `cards.ts` (article card). Others (article-detail) — Phase 3.
Automated boundary guard — Phase 3. Swappability proof — Phase 4.

_Admin tooling is intentionally out of scope — it's internal, not a surface you'd
swap or AI-compose._
