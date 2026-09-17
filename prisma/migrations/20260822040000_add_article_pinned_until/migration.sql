-- Auto-expiry for a pinned article: when the pin releases (default +7 days).
ALTER TABLE "Article" ADD COLUMN "pinnedUntil" TIMESTAMP(3);
