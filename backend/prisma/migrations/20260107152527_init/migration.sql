-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ratePartyType" TEXT NOT NULL,
    "ratePartyId" TEXT NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "tripId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentRecord_ratePartyType_idx" ON "PaymentRecord"("ratePartyType");

-- CreateIndex
CREATE INDEX "PaymentRecord_ratePartyId_idx" ON "PaymentRecord"("ratePartyId");

-- CreateIndex
CREATE INDEX "PaymentRecord_date_idx" ON "PaymentRecord"("date");
