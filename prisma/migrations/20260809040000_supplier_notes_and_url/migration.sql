-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "supplierUrl" TEXT;

-- AlterTable
ALTER TABLE "Testimonial" DROP COLUMN "showOnSupplierPage";

-- CreateTable
CREATE TABLE "SupplierNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierNote_userId_vendorId_idx" ON "SupplierNote"("userId", "vendorId");

-- AddForeignKey
ALTER TABLE "SupplierNote" ADD CONSTRAINT "SupplierNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierNote" ADD CONSTRAINT "SupplierNote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
