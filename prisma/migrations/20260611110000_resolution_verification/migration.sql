-- DropIndex
DROP INDEX "issue_verification_issueId_userId_key";

-- AlterTable
ALTER TABLE "issue_verification" ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'EXISTENCE';

-- CreateIndex
CREATE UNIQUE INDEX "issue_verification_issueId_userId_phase_key" ON "issue_verification"("issueId", "userId", "phase");
