-- AlterTable
ALTER TABLE "PaymentRecord" ADD COLUMN     "availableBalance" DOUBLE PRECISION,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "closingBalance" DOUBLE PRECISION,
ADD COLUMN     "entryType" TEXT NOT NULL DEFAULT 'PAYMENT',
ADD COLUMN     "fromAccount" TEXT,
ADD COLUMN     "headAccount" TEXT,
ADD COLUMN     "siteExpense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "toAccount" TEXT,
ADD COLUMN     "via" TEXT,
ADD COLUMN     "voucherUploads" JSONB,
ALTER COLUMN "ratePartyType" DROP NOT NULL,
ALTER COLUMN "ratePartyId" DROP NOT NULL,
ALTER COLUMN "counterpartyName" DROP NOT NULL,
ALTER COLUMN "method" DROP NOT NULL,
ALTER COLUMN "remarks" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PaymentRecord_entryType_idx" ON "PaymentRecord"("entryType");
