-- Relax required fields for one-off master data entries
ALTER TABLE "MineQuarry" ALTER COLUMN "contactNumber" DROP NOT NULL;
ALTER TABLE "MineQuarry" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "MineQuarry" ALTER COLUMN "siteLocationId" DROP NOT NULL;
ALTER TABLE "MineQuarry" ALTER COLUMN "companyName" DROP NOT NULL;
ALTER TABLE "MineQuarry" ALTER COLUMN "gstNumber" DROP NOT NULL;
ALTER TABLE "MineQuarry" ALTER COLUMN "gstDetails" DROP NOT NULL;
ALTER TABLE "MineQuarry" ALTER COLUMN "remarks" DROP NOT NULL;

ALTER TABLE "VendorCustomer" ALTER COLUMN "contactNumber" DROP NOT NULL;
ALTER TABLE "VendorCustomer" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "VendorCustomer" ALTER COLUMN "siteLocationId" DROP NOT NULL;
ALTER TABLE "VendorCustomer" ALTER COLUMN "companyName" DROP NOT NULL;
ALTER TABLE "VendorCustomer" ALTER COLUMN "gstNumber" DROP NOT NULL;
ALTER TABLE "VendorCustomer" ALTER COLUMN "gstDetails" DROP NOT NULL;
ALTER TABLE "VendorCustomer" ALTER COLUMN "remarks" DROP NOT NULL;

ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "contactNumber" DROP NOT NULL;
ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "siteLocationId" DROP NOT NULL;
ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "companyName" DROP NOT NULL;
ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "gstNumber" DROP NOT NULL;
ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "gstDetails" DROP NOT NULL;
ALTER TABLE "RoyaltyOwnerProfile" ALTER COLUMN "remarks" DROP NOT NULL;

ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "contactNumber" DROP NOT NULL;
ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "siteLocationId" DROP NOT NULL;
ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "companyName" DROP NOT NULL;
ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "gstNumber" DROP NOT NULL;
ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "gstDetails" DROP NOT NULL;
ALTER TABLE "TransportOwnerProfile" ALTER COLUMN "remarks" DROP NOT NULL;
