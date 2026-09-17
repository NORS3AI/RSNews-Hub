-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL DEFAULT '',
    "hrefLabel" TEXT NOT NULL DEFAULT '',
    "targetAt" TIMESTAMP(3),
    "showCountdown" BOOLEAN NOT NULL DEFAULT false,
    "size" TEXT NOT NULL DEFAULT 'md',
    "ticker" BOOLEAN NOT NULL DEFAULT false,
    "order" TEXT NOT NULL DEFAULT 'message,countdown,button',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

