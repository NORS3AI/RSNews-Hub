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
| `region`, `storeType` | analytics segmentation |
| `roles: ["admin"]` (or `accountType=STAFF`) | grants access to the hub admin area |

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
# also read: x-member-region, x-member-store-type, x-member-staff (true/1)
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
per member (closed until the next poll), one quiz submission, and — next on our
list — server-side **favorites / pinned / saved clippings** so they follow the
member across devices (today those still live in the browser). None of that
needs anything from you beyond the verified id above.

`GET /api/health` reports the active `authMode` so you can confirm the wiring.
