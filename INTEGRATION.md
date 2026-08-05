# Connecting the hub to the RS News website

The hub is a **gated area of the RS News site**, not a standalone app. Members
log in on the website (accounts already live in your database); being a
logged-in member is what unlocks the hub. **The hub never runs its own
signup/login in production** — your site tells it who the verified member is, and
the hub stores that member's hub activity (poll votes, quiz answers, saved
clippings, favorites, reading history, analytics) keyed to your account id.

This is deliberately tiny to wire up. There is **one integration point**:
`src/lib/identity/` — resolve "who is the verified member on this request?".
Everything else already works against whatever id it returns.

## What the hub needs from you

The **minimum**: a stable account id per request (`sub`). Optionally, a few
attributes so reports are richer (they're never required):

| Claim / header | Used for |
|---|---|
| `sub` (**required**) | the stable account id — the key for all hub state |
| `email`, `name` | display + notifications |
| `accountType` = `MEMBER` \| `VENDOR` \| `STAFF` | analytics segmentation; `STAFF` also grants hub-admin |
| `tier` (e.g. `premium`) | entitlements — unlock tier-gated content/perks |
| `affiliations` (array or comma list, e.g. `["packagehub"]`) | entitlements — unlock affiliation-gated content (e.g. Package Hub–only) |
| `vendorBrand` (or `brand`) | the ad brand a vendor owns — unlocks their vendor dashboard and surfaces their own ads first |
| `region`, `storeType` | analytics segmentation |
| `roles: ["admin"]` (or `accountType=STAFF`) | grants access to the hub admin area |

`tier` and `affiliations` are **free-form strings** — the hub never hardcodes an
enum, so you can add new tiers or affiliations any time without a hub change (see
`src/lib/entitlements.ts`). Gating a piece of content on `packagehub`, or adding a
`franchisee` affiliation later, is purely a data change.

The hub provisions a local "mirror" row for each member on first visit and keeps
those cached attributes fresh on every request. You do **not** send passwords.

## Pick a mode (`AUTH_MODE`)

### `AUTH_MODE=jwt` — recommended
After your site logs a member in, issue a short-lived JWT signed **HS256** with a
secret shared with the hub, and either set it as a cookie on the shared domain or
send it as `Authorization: Bearer`. The hub verifies and reads the claims.

```
AUTH_MODE=jwt
PARENT_JWT_SECRET=<the same secret your site signs with>
PARENT_SESSION_COOKIE=rsnews_sso     # cookie the hub reads (default rsnews_sso)
PARENT_JWT_ISSUER=https://rsnews.example      # optional, validated if set
PARENT_JWT_AUDIENCE=rsnews-hub                # optional, validated if set
```

Example token your site signs (any language; Node shown):

```js
import { SignJWT } from 'jose';
const token = await new SignJWT({
  email: user.email, name: user.name,
  accountType: user.isVendor ? 'VENDOR' : 'MEMBER',
  tier: user.tier,                       // e.g. 'premium'
  affiliations: user.affiliations,       // e.g. ['packagehub']
  vendorBrand: user.adBrand,             // vendors only — the ad brand they own
  region: user.region, storeType: user.storeType,
  roles: user.isStaff ? ['admin'] : [],
})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(String(user.id))          // <-- the stable account id
  .setIssuedAt().setExpirationTime('30m')
  .sign(new TextEncoder().encode(process.env.PARENT_JWT_SECRET));
// set it as the `rsnews_sso` cookie on your shared domain, or pass as Bearer.
```

Rotate it as often as you like (short expiry is fine — the hub re-reads it each
request). Expired/invalid ⇒ the hub treats the visitor as signed-out.

### `AUTH_MODE=header` — only behind a trusted proxy
If a reverse proxy authenticates and injects the member on headers, the hub can
trust them — **only** if the hub is unreachable except through that proxy and the
proxy strips any client-supplied copies (otherwise they can be spoofed).

```
AUTH_MODE=header
# defaults shown; override the names if your proxy differs
PARENT_HEADER_ID=x-member-id            # required header
PARENT_HEADER_EMAIL=x-member-email
PARENT_HEADER_NAME=x-member-name
PARENT_HEADER_ACCOUNT_TYPE=x-member-type
# also read: x-member-region, x-member-store-type, x-member-staff (true/1),
#            x-member-tier, x-member-affiliations (comma/space list), x-member-brand
```

### `AUTH_MODE=local` — default (dev / standalone only)
The hub uses its own cookie login (the `/login` + `/register` pages) so it's
fully testable on its own. **Do not use in production** — in delegated modes the
hub's own login/register are disabled automatically.

## Direct database access?
If you'd rather the hub read members straight from your DB, that's a fourth
option: add a `db` provider in `src/lib/identity/` implementing the same one
method (`resolve(): Promise<Member | null>`) that looks the member up by your
session. The rest of the hub is unchanged. Ask and we'll wire it to your schema.

## What "who the member is" unlocks
Once identity is flowing, the hub keys everything to that account: one poll vote
per member (closed until the next poll), one quiz submission, and server-side
favorites / pinned / saved clippings so they follow the member across devices.
The entitlement facets above additionally power:

- **Vendor dashboard** (`/docs/vendor`) — a member with a `vendorBrand` (or
  `accountType=VENDOR`) sees their live campaigns, flight countdowns, history,
  and quarterly performance reports.
- **Vendor-favored ads** — while a vendor is browsing, their own brand's live
  ads are surfaced first in article ad slots.
- **Entitlement-gated content** — `tier` / `affiliations` let you show content or
  perks to just premium members or a specific affiliation (e.g. Package Hub).

None of that needs anything from you beyond the verified claims above.

`GET /api/health` reports the active `authMode` so you can confirm the wiring.

## Ingesting ad submissions from JotForm
Vendors buy + submit ads on a JotForm form (package, dates, creative images).
Point a **JotForm webhook** at the hub and each submission becomes a **draft
campaign + creatives waiting for admin review** — nothing goes live until an
admin schedules a flight.

1. Set a secret and (optionally) map your form's field keys:
   ```
   JOTFORM_WEBHOOK_SECRET=<a long random string>
   # only the keys that differ from the defaults:
   JOTFORM_FIELD_MAP={"vendorName":"q3_company","plan":"q5_package","images":"q9_ads"}
   ```
2. In JotForm → **Settings → Integrations → Webhooks**, add:
   ```
   https://<your-hub-host>/api/ingest/jotform?key=<JOTFORM_WEBHOOK_SECRET>
   ```
   (or send the secret as an `x-jotform-token` header instead of the query key).

What the hub does with each submission:
- verifies the secret (timing-safe) and **dedupes on the JotForm submission id**
  (a re-delivered webhook can't double-create);
- resolves/creates the `Vendor`, creates a **DRAFT** `AdCampaign` (its plan
  mapped from the submitted package, split into 3-month flights);
- fetches each creative **only from JotForm's own hosts** (SSRF-guarded, size +
  timeout capped), runs it through the image pipeline, and files it as an
  inactive creative;
- records the raw submission for audit; failures are kept and surfaced in the
  admin (`/admin/campaigns`) rather than lost.

Unset `JOTFORM_WEBHOOK_SECRET` disables the endpoint (returns 503). Renewals are
just new submissions — the same flow drafts the next campaign for review.

**Reminder emails.** Map an `email` field so the hub captures each vendor's
contact address. A nightly `POST /api/ads/maintenance` (call it from your
scheduler with `Authorization: Bearer $CRON_SECRET`) emails vendors when a flight
needs fresh ads (21 days out) or a campaign is up for renewal (30 days out). The
**copy is admin-editable** at `/admin/email-templates` — subject + body with
`{mergeTags}` (vendor name, package, date, days, and `{submitUrl}`) that fill in
per vendor; set `AD_ORDER_URL` to your JotForm ad-order link so `{submitUrl}`
resolves automatically. Delivery needs `EMAIL_FROM` + a provider key
(`RESEND_API_KEY` or `SENDGRID_API_KEY`; see the email section); without them the
reminders are logged, not sent.

**Payment confirmation.** No money is handled by the hub — all paying happens on
JotForm. The hub only records **whether** a campaign's payment is confirmed, and a
campaign can't go live (schedule a flight) until it is. If your JotForm collects
payment, map `paymentAmount` / `paymentId` / `paymentStatus` and the hub confirms
it automatically (deduped on the transaction id). Otherwise an admin confirms it
on the campaign page (comped, or after verifying the JotForm payment landed).
