-- Add a "series" label to comics so multiple strips (e.g. Backroom Humor,
-- Counter Productive) can share the comic slot. Existing rows default to
-- Backroom Humor.
ALTER TABLE "Comic" ADD COLUMN "series" TEXT NOT NULL DEFAULT 'Backroom Humor';
