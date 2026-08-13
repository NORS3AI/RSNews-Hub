-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "previewToken" TEXT;

-- CreateTable
CREATE TABLE "ArticleReview" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleReview_articleId_createdAt_idx" ON "ArticleReview"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_previewToken_key" ON "Article"("previewToken");

-- AddForeignKey
ALTER TABLE "ArticleReview" ADD CONSTRAINT "ArticleReview_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

