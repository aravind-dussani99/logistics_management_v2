-- AlterTable
ALTER TABLE "TripRecord" ADD COLUMN     "actualVendorCustomerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vendorCustomerRatePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0;
