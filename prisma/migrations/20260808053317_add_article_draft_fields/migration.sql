-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "draftContent" TEXT,
ADD COLUMN     "draftCover" TEXT,
ADD COLUMN     "draftExcerpt" TEXT,
ADD COLUMN     "draftSavedAt" TIMESTAMP(3),
ADD COLUMN     "draftTitle" TEXT;
