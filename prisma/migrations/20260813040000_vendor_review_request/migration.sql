-- CreateTable
CREATE TABLE "VendorReviewRequest" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VendorReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorReviewRequest_vendorId_createdAt_idx" ON "VendorReviewRequest"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorReviewRequest_articleId_idx" ON "VendorReviewRequest"("articleId");

-- AddForeignKey
ALTER TABLE "VendorReviewRequest" ADD CONSTRAINT "VendorReviewRequest_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

