-- CreateTable
CREATE TABLE "TestimonialRequest" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestimonialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "showOnSupplierPage" BOOLEAN NOT NULL DEFAULT false,
    "showOnVendorDashboard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestimonialRequest_vendorId_idx" ON "TestimonialRequest"("vendorId");

-- CreateIndex
CREATE INDEX "Testimonial_vendorId_idx" ON "Testimonial"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_userId_vendorId_key" ON "Testimonial"("userId", "vendorId");

-- AddForeignKey
ALTER TABLE "TestimonialRequest" ADD CONSTRAINT "TestimonialRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
