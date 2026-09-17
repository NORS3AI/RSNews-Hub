-- AlterTable: anchor a note to the passage the writer highlighted.
ALTER TABLE "NewsroomComment" ADD COLUMN     "quote" TEXT;
ALTER TABLE "NewsroomComment" ADD COLUMN     "quoteStart" INTEGER;
