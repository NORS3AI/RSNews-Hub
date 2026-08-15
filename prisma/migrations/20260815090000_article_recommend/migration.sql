-- Reader endorsements ("Recommend"): denormalized count + per-reader dedup rows.
ALTER TABLE "Article" ADD COLUMN "recommends" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ArticleRecommend" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleRecommend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArticleRecommend_articleId_userId_key" ON "ArticleRecommend"("articleId", "userId");
CREATE UNIQUE INDEX "ArticleRecommend_articleId_sessionId_key" ON "ArticleRecommend"("articleId", "sessionId");
CREATE INDEX "ArticleRecommend_articleId_idx" ON "ArticleRecommend"("articleId");
ALTER TABLE "ArticleRecommend" ADD CONSTRAINT "ArticleRecommend_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleRecommend" ADD CONSTRAINT "ArticleRecommend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
