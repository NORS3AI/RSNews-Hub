export const ROLES = ['ADMIN', 'EDITOR', 'USER'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'TRASHED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const SITE_NAME = 'RSNews Hub';
export const SITE_DESCRIPTION = 'News, articles and documentation — read, discover, subscribe.';
