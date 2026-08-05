# Accessibility to-do (ADA / WCAG 2.1 AA)

A running checklist for making RSNews Hub accessible. Target is **WCAG 2.1 AA**
(the level ADA case law generally points to). This is a to-do list, not a claim
of compliance. Ordered by priority × payoff. Nothing here is a crisis — the app
is in decent shape; these are the gaps worth closing before a wide reveal.

## Already handled (don't redo these)
- [x] `<html lang="en">` set (screen readers pick the right voice).
- [x] Modals use `role="dialog"` + `aria-modal="true"` + an `aria-label`, and
      close on **Escape** (article reader, quiz, comic lightbox, share, clippings).
- [x] Icon-only buttons carry `aria-label` (menu, close, carousel arrows, …).
- [x] `prefers-reduced-motion` is honored globally + in the video ad.
- [x] Carousels are **manual** (no autoplay) — no "moving content" violation.
- [x] Visible focus rings are defined (`focus:ring-2`) in the base styles.
- [x] Form inputs have real `<label>` + `id` pairing (login/register).
- [x] Base palette is orange-vs-slate (warm/dark), not red/green — already
      readable for the common colorblindness types.

## To-do — high priority
- [ ] **Color is never the only signal** (the colorblind pass). Audit charts and
      any up/down or good/bad indicators so meaning is also carried by a label,
      icon, or +/− sign — not hue alone. Status badges already pair color with a
      word (ACTIVE, PUBLISHED), so those are fine; the risk is graphs where series
      are told apart only by color. _(WCAG 1.4.1)_
- [ ] **Image alt text.** Today article covers, ad creatives, and editor previews
      render `alt=""` (which tells a screen reader "skip me"). These are meaningful
      images. Add an **alt-text field** to the article editor + ad/creative upload,
      store it, and render it as the real `alt`. Fall back to the title only when
      the author leaves it blank. _(WCAG 1.1.1 — the single biggest real gap.)_
- [ ] **Keyboard focus traps in modals.** Modals close on Escape but don't yet (a)
      keep Tab focus inside the open dialog, (b) move focus into the dialog on open,
      or (c) return focus to the trigger on close. Add a small focus-trap so keyboard
      and screen-reader users can't tab "behind" the overlay. _(WCAG 2.1.2 / 2.4.3)_

## To-do — medium priority
- [ ] **Skip-to-content link.** A first-focusable "Skip to content" link so keyboard
      users don't tab through the whole sidebar on every page. _(WCAG 2.4.1)_
- [ ] **Contrast audit.** Check orange text (`#E97D34`) and the `--muted` text color
      against **4.5:1** on their real backgrounds (cream + dark). Orange as *text*
      often fails; orange as an accent/fill on chips and buttons is fine. Darken the
      text token or reserve orange for large/bold text where it falls short.
      _(WCAG 1.4.3)_
- [ ] **Toggle-button state.** Star / save-to-read buttons should expose
      `aria-pressed` so a screen reader announces "favorited, pressed" vs. just
      "button". _(WCAG 4.1.2)_
- [ ] **Announce dynamic changes.** Save / favorite / quiz-submit / vote currently
      update silently. Add an `aria-live="polite"` region (or accessible toast) so
      screen-reader users hear the result. _(WCAG 4.1.3)_

## To-do — lower priority / polish
- [ ] **Form error wiring.** On login/register (and admin forms), link error text to
      the field with `aria-describedby` and set `aria-invalid` so the error is read
      out on focus. _(WCAG 3.3.1)_
- [ ] **Heading order.** Spot-check that each page has one `<h1>` and headings don't
      skip levels (screen-reader users navigate by heading). _(WCAG 1.3.1)_
- [ ] **200% zoom / reflow.** Verify no horizontal scroll or clipped content at 200%
      browser zoom and at a 320px-wide viewport. _(WCAG 1.4.10)_
- [ ] **Comics need descriptions.** Comic images are content — give each a text
      description (alt or caption), same as article covers. _(WCAG 1.1.1)_
- [ ] **Automated + manual check.** Run axe-core (or Lighthouse a11y) over the main
      routes, then do one keyboard-only pass (Tab through a full read → favorite →
      submit-a-quiz flow) and one screen-reader smoke test.

---
_Not legally required to be perfect for an internal tool, but every item above also
just makes the hub nicer to use. Knock them out before opening it to advertisers or
a wide audience._
