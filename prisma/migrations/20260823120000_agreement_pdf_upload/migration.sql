-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "documentUrl" TEXT,
ALTER COLUMN "text" DROP NOT NULL;

-- DropTable
DROP TABLE "AgreementSection";
