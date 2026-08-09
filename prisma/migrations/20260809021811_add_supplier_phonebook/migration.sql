-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "blurb" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "premium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "SavedSupplier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "note" TEXT,
    "altEmail" TEXT,
    "altPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSupplier_userId_idx" ON "SavedSupplier"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSupplier_userId_vendorId_key" ON "SavedSupplier"("userId", "vendorId");

-- AddForeignKey
ALTER TABLE "SavedSupplier" ADD CONSTRAINT "SavedSupplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSupplier" ADD CONSTRAINT "SavedSupplier_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
