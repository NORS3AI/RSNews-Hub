-- AlterTable
ALTER TABLE "SavedSupplier" ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "premiumEndedAt" TIMESTAMP(3),
ADD COLUMN     "premiumSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierSeen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierSeen_userId_idx" ON "SupplierSeen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSeen_userId_vendorId_key" ON "SupplierSeen"("userId", "vendorId");

-- AddForeignKey
ALTER TABLE "SupplierSeen" ADD CONSTRAINT "SupplierSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSeen" ADD CONSTRAINT "SupplierSeen_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

