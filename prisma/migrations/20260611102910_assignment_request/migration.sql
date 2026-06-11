-- AlterTable
ALTER TABLE "issue" ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "requestedToId" TEXT;

-- AddForeignKey
ALTER TABLE "issue" ADD CONSTRAINT "issue_requestedToId_fkey" FOREIGN KEY ("requestedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
