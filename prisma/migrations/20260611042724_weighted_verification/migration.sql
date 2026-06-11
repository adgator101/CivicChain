-- AlterTable
ALTER TABLE "issue_verification" ADD COLUMN     "isLocal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proofImages" TEXT[],
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;
