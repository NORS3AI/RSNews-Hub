# Module Studio — Product Spec & Build Plan

> Status: **Spec / not yet built.** This document is the source of truth for
> the drag-and-drop homepage builder ("Module Studio") and the theming work
> that goes with it. Captured from product direction on 2026-08-05.

---

## 1. The vision, in one sentence

A **JotForm-style visual builder** where an admin composes homepage modules by
dragging blocks from a left palette onto a center canvas, tunes each block in a
right-hand settings panel, and publishes the result to the live homepage — with
everything auto-sizing and auto-spacing so nothing ever has to be pixel-perfect.

## 2. The three-pane layout

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  PALETTE     │           CANVAS              │    INSPECTOR     │
│  (left)      │          (center)             │    (right)       │
│              │                               │                  │
│ Containers   │  Drop a container, then drop  │  Settings for    │
│  · Column    │  blocks inside it. Drag to    │  the selected    │
│  · Row       │  reorder. Auto-fit + auto-gap.│  block (opens    │
│  · Grid      │                               │  when you click  │
│  · Card      │  Each block shows a gear on   │  its gear).      │
│              │  hover → opens the inspector. │                  │
│ Blocks       │                               │  JotForm-style   │
│  · Article   │                               │  panel.          │
│  · Article+img                                                  │
│  · Ad        │                               │                  │
│  · Poll      │                               │                  │
│  · Heading   │                               │                  │
│  · Text      │                               │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

- **Palette (left):** two groups — *Containers* (the shells) and *Blocks* (the
  content that goes inside them). Drag any item onto the canvas.
- **Canvas (center):** the live module being built. Drop a container first;
  drop blocks into it; drag blocks to reorder within the container. Layout is
  automatic — flex/grid with consistent gaps — so spacing/sizing self-adjusts
  and the admin never fights pixels.
- **Inspector (right):** appears when a block's **gear** is clicked. Shows that
  block's settings. Closing/selecting another block swaps the panel.

## 3. Containers (module shells)

Draggable shapes the admin picks first. Each is a responsive shell that lays out
its children automatically.

| Shape  | Description                                             |
|--------|---------------------------------------------------------|
| Column | Tall, narrow, single vertical stack. (The hero example.)|
| Row    | Horizontal band of blocks.                              |
| Grid   | Auto-flowing grid (2–4 cols, responsive).               |
| Card   | A single framed block.                                  |

Containers auto-fit their children: drop an ad in a narrow column and it renders
at the column's width; gaps between children stay uniform automatically.

## 4. Blocks (content elements)

Dragged from the palette into a container. Each block type:

| Block          | Renders                                   | Key settings |
|----------------|-------------------------------------------|--------------|
| Article        | Headline + dek, **no image**              | source/pick article, show dek?, color |
| Article + image| Headline + dek **with** image             | source/pick article, image position, color |
| Ad             | Ad slot                                   | slot/size (auto to container), color = orange texture by default |
| Poll           | Live reader poll                          | question, options, **timer**, color |
| Heading        | Section title                             | text, level, color |
| Text           | Freeform rich text                        | body, color |

Every block carries a **gear** → opens the inspector for its settings.

## 5. The Inspector (right panel)

Opened per-block via the gear. Contents depend on block type. Universal items:

- **Color** — per-block color override (see §7 Theming; **RS Mode only**).
- **Remove** block.
- **Duplicate** block.

Block-specific highlight — **Poll settings**:

- Question + options.
- **Timer** (e.g. 72 hours). On expiry the poll:
  1. **Auto-hides** from the homepage.
  2. Is written to the **admin log**.
  3. Is moved to the **polls archive**.
- (Timer lifecycle needs a scheduled sweep — see §9.)

## 5.5 Inline homepage editing (admin overlay)

When an admin views the live homepage, every module shows a small **pencil/edit
icon in its corner**. This is the "edit in place" path (complementing the full
Studio):

- **Reorder contents** of that module directly — including modules whose content
  scrolls horizontally off-screen (the 10-article carousels): the overlay lets
  you drag/reorder within the scroller.
- **Quick color changes without leaving the page:** change the module
  **background color** and **per-element colors** inline, with **live preview**
  right on the homepage so you immediately see the result.
- **Or** the pencil can **open that module in the full Module Studio** for
  deeper edits.
- **Unsaved-changes guard ("follow along"):** once you make an inline change,
  the app tracks it and **warns before you navigate away** if it isn't
  saved/published ("You haven't published this / it's not saved"). Nothing is
  silently lost.
- The existing admin ability to **drag-reorder whole modules** on the homepage
  stays as-is. ✅ (already shipped)

## 6. Save → place → publish flow

1. Admin builds a module on the canvas.
2. **Save module** — persists it as a reusable custom module.
3. Add it to the **homepage preview** and drag it to the desired position
   (this reuses the existing homepage layout editor / DnD + lock system).
4. When happy with position, **Publish** → live homepage updates.

Custom modules live alongside the existing catalog modules
(`recommended`, `latest`, `trending`, `feature-carousel`, ads, comic, etc.) in
the same layout list, so ordering/lock/visibility all keep working.

## 7. Theming

Three themes exist today: **Light**, **Dark**, **RS Mode** (light palette +
textured surfaces). Toggle cycles Light → Dark → RS; already persisted to
`localStorage` and re-applied on load (no flash).

New theming requirements:

- **Per-block color override** (from the inspector) applies **only in RS Mode.**
  Example: poll = dark gray, articles = cream. Light/Dark stay standard and are
  unaffected by per-block colors.
- **Ads** default to the **orange texture background** in RS Mode.
- **Custom RS Mode background** — admin can set the RS Mode page background.
- Light & Dark remain standard system modes. *Possible future:* per-mode
  override hooks, but not required for v1.

### Theme persistence

- **Per-device:** already works (localStorage). ✅
- **Per-account:** remember the user's chosen theme on their account so it
  follows them across devices (store on `User`, hydrate on login, fall back to
  localStorage for anonymous visitors). ⬜ To build.

### Theme analytics

- Track **how many users use each mode** (Light / Dark / RS). Emit an analytics
  event on theme apply/change; surface counts in the admin analytics dashboard.
  ⬜ To build.

## 8. Data model (proposed)

A custom module is a **composition tree** stored as JSON:

```jsonc
{
  "type": "container",
  "shape": "column",              // column | row | grid | card
  "rsColor": null,                // RS-mode-only bg override
  "children": [
    { "type": "poll",    "id": "…", "rsColor": "#3a3a3a", "settings": { "timerHours": 72, "question": "…", "options": ["…"] } },
    { "type": "article", "id": "…", "rsColor": "#f5eede", "settings": { "source": "latest", "showImage": false } },
    { "type": "article", "id": "…", "rsColor": "#f5eede", "settings": { "source": "latest", "showImage": true } },
    { "type": "ad",      "id": "…", "rsColor": null,       "settings": { "slot": "auto" } }
  ]
}
```

- Introduce a `CustomModule` concept (new Prisma model **or** a namespaced entry
  in `Setting`). Each saved module gets a stable id (e.g. `custom:<uuid>`).
- The homepage layout list references custom modules by that id, so the existing
  `HomeModule` / `getHomeLayout` / `applyReorder` machinery keeps working.
- A **renderer** turns the tree into React on the public homepage, mirroring how
  catalog modules render today.

## 9. Poll timer lifecycle

- Poll blocks store an expiry (`createdAt + timerHours`).
- A scheduled sweep (cron / route hit on render) finds expired polls, hides
  them, appends an **admin-log** entry, and moves them to the **polls archive**
  (the `Poll` model + polls admin page already exist — wire archive state).

## 10. Build phases (each ships independently)

- **Phase 0 — Spec (this doc).** ✅
- **Phase 1 — Quick, standalone wins** (low risk, no builder dependency): ✅
  - Account-remembered theme (sync chosen theme to `User`). ✅
  - Theme-usage analytics + admin dashboard tile. ✅
- **Phase 2 — Data model + renderer.** ✅ `CustomModule` tree schema, save/load,
  renderer, slotted into the homepage layout list.
  - **Phase 2b — Live homepage integration.** ✅ Published modules render on
    `/docs` with real content: article blocks auto-fill from their source pool
    (deduped within the module), ad blocks show real creatives, heading/text are
    live. Publishing auto-places the module on the homepage (reorderable). Poll
    blocks render live once Phase 5 lands.
- **Phase 3 — The Studio UI.** ✅ Three-pane builder: palette, canvas with
  drag-drop + auto-layout + reorder, inspector.
- **Phase 4 — Block settings + per-block RS color.** ✅ (shipped with Phase 3)
  Inspector fields per block type; RS-mode color overrides; ad orange default.
- **Phase 5 — Poll timer lifecycle.** ✅ Poll blocks materialize into real,
  votable `Poll` records (kind `module`) on publish, with `closesAt` from the
  timer. A lazy sweep closes expired polls, hides them from their module, and
  writes an `AdminLog` entry; they remain in the polls archive. Live polls render
  via the existing `PollCard`. Activity log surfaced on the Studio page.
- **Phase 6 — Inline homepage editing (§5.5)** — ✅ (v1) Admins see a hover
  "Edit" chip on every homepage module: custom modules open in the Studio,
  catalog modules open the layout manager. The editor gained Publish/Unpublish
  + a draft "not live yet" nudge, on top of the existing unsaved-changes guard.
  *Deferred:* tweaking colors/order directly on the homepage with live preview
  (today you edit in the Studio, which shows a live canvas + RS preview).
- **Phase 8 — "Go Live" staging.** ✅ Homepage arrangement edits (reorder,
  visibility, lock, custom-module placement) go to a **draft** layout; the public
  homepage renders the **live** layout until an admin presses **Go Live**
  (Discard reverts to live). Publishing a Studio module stages it into the draft;
  a module left unpublished is "saved for later" in the Studio library.
- **Phase 7 — Custom RS Mode background** + polish. ✅ Admins can set the
  RS-Mode page background color from the Homepage layout page; it's injected
  server-side (validated hex) and applies only in RS Mode. Clearing it restores
  the default textured surround.

## 11. Open questions

- Custom modules: dedicated Prisma model vs. JSON in `Setting`? (Leaning: a
  small `CustomModule` table for clean querying + per-module publish state.)
- Poll expiry sweep: real cron vs. lazy check on homepage render? (Leaning:
  lazy check on render + admin action, to avoid infra dependencies.)
- Rich text block: reuse the article editor's rich-text component?
