-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE INDEX "Genre_archived_sortOrder_idx" ON "Genre"("archived", "sortOrder");


-- Seed the four built-in genres (idempotent). Their slugs are load-bearing:
-- 'sponsored' drives the paid-content disclosure + sponsor go-live email.
INSERT INTO "Genre" ("id","slug","label","color","builtin","archived","sortOrder","createdAt","updatedAt") VALUES
  ('genre_opinion','opinion','Opinion','#8b5cf6',true,false,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('genre_sponsored','sponsored','Sponsored','#d97706',true,false,2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('genre_press_release','press_release','Press release','#64748b',true,false,3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('genre_update','update','Update','#3b82f6',true,false,4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
