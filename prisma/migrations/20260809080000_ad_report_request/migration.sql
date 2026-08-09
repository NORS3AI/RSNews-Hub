-- CreateTable
CREATE TABLE "AdReportRequest" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "AdReportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdReportRequest_vendorId_idx" ON "AdReportRequest"("vendorId");
-- CreateIndex
CREATE INDEX "AdReportRequest_status_idx" ON "AdReportRequest"("status");

-- AddForeignKey
ALTER TABLE "AdReportRequest" ADD CONSTRAINT "AdReportRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AdReportRequest" ADD CONSTRAINT "AdReportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
