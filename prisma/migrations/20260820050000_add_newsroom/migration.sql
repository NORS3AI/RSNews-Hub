-- CreateTable
CREATE TABLE "NewsroomDoc" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled draft',
    "body" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "pushedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsroomDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsroomComment" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsroomComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsroomPresence" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "editing" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsroomPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsroomDoc_archived_pushedAt_updatedAt_idx" ON "NewsroomDoc"("archived", "pushedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "NewsroomComment_docId_createdAt_idx" ON "NewsroomComment"("docId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsroomPresence_docId_lastSeen_idx" ON "NewsroomPresence"("docId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "NewsroomPresence_docId_userId_key" ON "NewsroomPresence"("docId", "userId");

-- AddForeignKey
ALTER TABLE "NewsroomComment" ADD CONSTRAINT "NewsroomComment_docId_fkey" FOREIGN KEY ("docId") REFERENCES "NewsroomDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsroomPresence" ADD CONSTRAINT "NewsroomPresence_docId_fkey" FOREIGN KEY ("docId") REFERENCES "NewsroomDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
