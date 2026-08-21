-- Per-user "pin" on a Newsroom draft, powering the editor's flagged-draft switcher.
CREATE TABLE "NewsroomFlag" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsroomFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsroomFlag_docId_userId_key" ON "NewsroomFlag"("docId", "userId");
CREATE INDEX "NewsroomFlag_userId_idx" ON "NewsroomFlag"("userId");

ALTER TABLE "NewsroomFlag" ADD CONSTRAINT "NewsroomFlag_docId_fkey" FOREIGN KEY ("docId") REFERENCES "NewsroomDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
