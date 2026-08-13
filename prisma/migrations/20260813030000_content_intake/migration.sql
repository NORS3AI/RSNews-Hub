-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "sponsorNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "sponsorVendorId" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "autoCreated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ContentSubmission" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "matchStatus" TEXT NOT NULL DEFAULT 'new',
    "matchName" TEXT,
    "matchVendorId" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "articleId" TEXT,
    "adId" TEXT,
    "headline" TEXT,
    "error" TEXT,
    "raw" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentSubmission_submissionId_key" ON "ContentSubmission"("submissionId");

-- CreateIndex
CREATE INDEX "ContentSubmission_status_createdAt_idx" ON "ContentSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentSubmission_matchStatus_idx" ON "ContentSubmission"("matchStatus");

