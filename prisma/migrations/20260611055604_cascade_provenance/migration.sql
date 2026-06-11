-- AlterTable
ALTER TABLE "issue_chain_link" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ai';
