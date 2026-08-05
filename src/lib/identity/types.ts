// Identity seam — the ONE integration point between the hub and however members
// are authenticated. In production the hub is a gated area of the RS News
// website: the site authenticates the member and hands us a verified identity;
// the hub never runs its own login. In standalone/dev it falls back to the
// hub's own cookie login so everything is testable in isolation.
//
// A provider's job is only to answer "who is the verified member on this
// request?" — nothing else. All hub state (poll votes, quiz responses, saved
// clippings, favorites, reading history, analytics) is keyed to `externalId`.

export type Member = {
  /** Stable account id from the parent site. The key for all hub-owned state. */
  externalId: string;
  email?: string | null;
  name?: string | null;
  /** Audience + entitlement facets the parent may share (segmentation, gating,
   *  vendor recognition). tier/affiliations are free-form (see lib/entitlements). */
  accountType?: string | null; // MEMBER | VENDOR | STAFF
  tier?: string | null;        // e.g. BASIC | PREMIUM
  affiliations?: string[] | null; // e.g. ['packagehub']
  vendorBrand?: string | null; // for vendors: the ad brand they own
  region?: string | null;
  storeType?: string | null;
  /** True when the parent flags this member as hub staff/admin. */
  isStaff?: boolean;
};

export interface IdentityProvider {
  /** Short mode name, surfaced in the health report. */
  readonly mode: string;
  /** Resolve the verified member for the current request, or null if none. */
  resolve(): Promise<Member | null>;
}
