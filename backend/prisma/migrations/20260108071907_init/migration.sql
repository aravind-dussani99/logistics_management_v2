-- AlterTable
ALTER TABLE "TripRecord" ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "receivedByRole" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT,
ADD COLUMN     "validationComments" TEXT;

-- CreateTable
CREATE TABLE "TripActivityRecord" (
    "id" TEXT NOT NULL,
    "tripId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripActivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripActivityRecord_tripId_idx" ON "TripActivityRecord"("tripId");

-- CreateIndex
CREATE INDEX "TripActivityRecord_createdAt_idx" ON "TripActivityRecord"("createdAt");
