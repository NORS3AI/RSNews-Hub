export const ROLES = ['ADMIN', 'EDITOR', 'USER'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// Audience classification for analytics segmentation (distinct from ROLES, which
// are permissions). MEMBER = a reader/subscriber, VENDOR = an advertiser, STAFF = internal.
export const ACCOUNT_TYPES = ['MEMBER', 'VENDOR', 'STAFF'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'TRASHED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

// Statuses eligible for DISCOVERY surfaces (recommendations, trending, search,
// throwback sourcing). ARCHIVED = retired from the "current" surfaces (Latest,
// hero, Published this week) but still surfaceable via recommendations, so an
// aged article stays in rotation instead of vanishing. DRAFT/TRASHED never show.
export const RECOMMENDABLE_STATUSES = ['PUBLISHED', 'ARCHIVED'];

export const SITE_NAME = 'RS News Hub';
export const SITE_DESCRIPTION = 'News, articles and documentation — read, discover, subscribe.';

// Sender identity for compliance footers. CAN-SPAM (and CASL/GDPR good practice)
// requires every commercial email to carry the sender's real, valid physical
// postal address. Set MAILING_ADDRESS in the environment to the business's
// mailing address (a street address, P.O. box, or registered commercial mail
// receiving agent all qualify). Until it's set we fall back to the placeholder
// below — which is clearly a placeholder, so a live deploy without the env var
// is obvious rather than silently non-compliant.
export const ORG_LEGAL_NAME = process.env.ORG_LEGAL_NAME || 'RS News Hub';
export const MAILING_ADDRESS =
  process.env.MAILING_ADDRESS || '[Set MAILING_ADDRESS — your business postal address]';

// Bump on every pushed update. Shown in the footer; keep in sync with the
// static preview footer in docs/index.html.
export const APP_VERSION = 'v0.126.0';
