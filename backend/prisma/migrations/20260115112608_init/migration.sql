-- DropForeignKey
ALTER TABLE "MineQuarry" DROP CONSTRAINT "MineQuarry_siteLocationId_fkey";

-- DropForeignKey
ALTER TABLE "RoyaltyOwnerProfile" DROP CONSTRAINT "RoyaltyOwnerProfile_siteLocationId_fkey";

-- DropForeignKey
ALTER TABLE "TransportOwnerProfile" DROP CONSTRAINT "TransportOwnerProfile_siteLocationId_fkey";

-- DropForeignKey
ALTER TABLE "VendorCustomer" DROP CONSTRAINT "VendorCustomer_siteLocationId_fkey";

-- AddForeignKey
ALTER TABLE "MineQuarry" ADD CONSTRAINT "MineQuarry_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCustomer" ADD CONSTRAINT "VendorCustomer_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyOwnerProfile" ADD CONSTRAINT "RoyaltyOwnerProfile_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportOwnerProfile" ADD CONSTRAINT "TransportOwnerProfile_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
