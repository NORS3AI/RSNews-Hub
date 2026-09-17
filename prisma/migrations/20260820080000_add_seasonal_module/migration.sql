-- CreateTable
CREATE TABLE "SeasonalModule" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startDay" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonalModule_enabled_priority_idx" ON "SeasonalModule"("enabled", "priority");
