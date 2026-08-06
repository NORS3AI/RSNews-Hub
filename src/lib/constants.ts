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

export const SITE_NAME = 'RSNews Hub';
export const SITE_DESCRIPTION = 'News, articles and documentation — read, discover, subscribe.';

// Bump on every pushed update. Shown in the footer; keep in sync with the
// static preview footer in docs/index.html.
export const APP_VERSION = 'v0.92.0';
