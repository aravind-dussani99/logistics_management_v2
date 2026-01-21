-- AlterTable
ALTER TABLE "MaterialRate" ADD COLUMN     "tripId" INTEGER;

-- CreateIndex
CREATE INDEX "MaterialRate_tripId_idx" ON "MaterialRate"("tripId");
