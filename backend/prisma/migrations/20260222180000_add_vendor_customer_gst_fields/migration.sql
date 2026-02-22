ALTER TABLE "TripRecord"
ADD COLUMN "vendorCustomerGstPercentage" REAL NOT NULL DEFAULT 18,
ADD COLUMN "vendorCustomerGstAmount" REAL NOT NULL DEFAULT 0;
