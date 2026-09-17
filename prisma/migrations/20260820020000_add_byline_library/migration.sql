-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "bylineId" TEXT;

-- CreateTable
CREATE TABLE "Byline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "photo" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Byline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Byline_archived_name_idx" ON "Byline"("archived", "name");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_bylineId_fkey" FOREIGN KEY ("bylineId") REFERENCES "Byline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

