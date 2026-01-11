-- AlterTable
ALTER TABLE "TripRecord" ADD COLUMN     "vendorCustomerIsOneOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mineQuarryIsOneOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "royaltyOwnerIsOneOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vehicleIsOneOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transportOwnerIsOneOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rateOverrideEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rateOverride" JSONB;
