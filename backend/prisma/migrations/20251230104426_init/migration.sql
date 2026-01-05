-- CreateTable
CREATE TABLE "SiteLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pointOfContact" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "merchantTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siteLocationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstOptIn" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT NOT NULL,
    "gstDetails" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantBankAccount" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "ratePartyType" TEXT NOT NULL,
    "ratePartyId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaster" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "ownerName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MineQuarry" (
    "id" TEXT NOT NULL,
    "merchantTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siteLocationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstOptIn" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT NOT NULL,
    "gstDetails" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MineQuarry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCustomer" (
    "id" TEXT NOT NULL,
    "merchantTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siteLocationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstOptIn" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT NOT NULL,
    "gstDetails" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyOwnerProfile" (
    "id" TEXT NOT NULL,
    "merchantTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siteLocationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstOptIn" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT NOT NULL,
    "gstDetails" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoyaltyOwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportOwnerProfile" (
    "id" TEXT NOT NULL,
    "merchantTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siteLocationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstOptIn" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT NOT NULL,
    "gstDetails" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportOwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportOwnerVehicle" (
    "id" TEXT NOT NULL,
    "transportOwnerId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportOwnerVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialTypeDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialTypeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRate" (
    "id" TEXT NOT NULL,
    "materialTypeId" TEXT NOT NULL,
    "ratePartyType" TEXT NOT NULL,
    "ratePartyId" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "dropOffLocationId" TEXT NOT NULL,
    "totalKm" DOUBLE PRECISION NOT NULL,
    "ratePerKm" DOUBLE PRECISION NOT NULL,
    "ratePerTon" DOUBLE PRECISION NOT NULL,
    "gstChargeable" BOOLEAN NOT NULL DEFAULT false,
    "gstPercentage" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "totalRatePerTon" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRecord" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tripId" INTEGER,
    "ratePartyType" TEXT,
    "ratePartyId" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "fromAccount" TEXT NOT NULL,
    "toAccount" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "invoiceDCNumber" TEXT NOT NULL,
    "ownerAndTransporterName" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "voucherSlipUpload" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyExpenseRecord" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "ratePartyType" TEXT,
    "ratePartyId" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "availableBalance" DOUBLE PRECISION NOT NULL,
    "closingBalance" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyExpenseOpeningBalance" (
    "id" TEXT NOT NULL,
    "supervisorName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyExpenseOpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripRecord" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "place" TEXT NOT NULL,
    "pickupPlace" TEXT NOT NULL,
    "dropOffPlace" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "invoiceDCNumber" TEXT NOT NULL,
    "quarryName" TEXT NOT NULL,
    "royaltyOwnerName" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "transporterName" TEXT NOT NULL,
    "transportOwnerMobileNumber" TEXT NOT NULL,
    "emptyWeight" DOUBLE PRECISION NOT NULL,
    "grossWeight" DOUBLE PRECISION NOT NULL,
    "netWeight" DOUBLE PRECISION NOT NULL,
    "royaltyNumber" TEXT NOT NULL,
    "royaltyTons" DOUBLE PRECISION NOT NULL,
    "royaltyM3" DOUBLE PRECISION NOT NULL,
    "deductionPercentage" DOUBLE PRECISION NOT NULL,
    "sizeChangePercentage" DOUBLE PRECISION NOT NULL,
    "tonnage" DOUBLE PRECISION NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "materialCost" DOUBLE PRECISION NOT NULL,
    "transportCost" DOUBLE PRECISION NOT NULL,
    "royaltyCost" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "ewayBillUpload" TEXT NOT NULL,
    "invoiceDCUpload" TEXT NOT NULL,
    "waymentSlipUpload" TEXT NOT NULL,
    "royaltyUpload" TEXT NOT NULL,
    "taxInvoiceUpload" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3),
    "endEmptyWeight" DOUBLE PRECISION,
    "endGrossWeight" DOUBLE PRECISION,
    "endNetWeight" DOUBLE PRECISION,
    "endWaymentSlipUpload" TEXT,
    "weightDifferenceReason" TEXT,
    "pendingRequestType" TEXT,
    "pendingRequestMessage" TEXT,
    "pendingRequestBy" TEXT,
    "pendingRequestRole" TEXT,
    "pendingRequestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecord" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "targetRole" TEXT,
    "targetUser" TEXT,
    "tripId" INTEGER,
    "requestType" TEXT,
    "requesterName" TEXT,
    "requesterRole" TEXT,
    "requestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteLocation_name_idx" ON "SiteLocation"("name");

-- CreateIndex
CREATE INDEX "MerchantType_name_idx" ON "MerchantType"("name");

-- CreateIndex
CREATE INDEX "Merchant_name_idx" ON "Merchant"("name");

-- CreateIndex
CREATE INDEX "MerchantBankAccount_accountNumber_idx" ON "MerchantBankAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "AccountType_name_idx" ON "AccountType"("name");

-- CreateIndex
CREATE INDEX "VehicleMaster_vehicleNumber_idx" ON "VehicleMaster"("vehicleNumber");

-- CreateIndex
CREATE INDEX "MineQuarry_name_idx" ON "MineQuarry"("name");

-- CreateIndex
CREATE INDEX "VendorCustomer_name_idx" ON "VendorCustomer"("name");

-- CreateIndex
CREATE INDEX "RoyaltyOwnerProfile_name_idx" ON "RoyaltyOwnerProfile"("name");

-- CreateIndex
CREATE INDEX "TransportOwnerProfile_name_idx" ON "TransportOwnerProfile"("name");

-- CreateIndex
CREATE INDEX "TransportOwnerVehicle_transportOwnerId_idx" ON "TransportOwnerVehicle"("transportOwnerId");

-- CreateIndex
CREATE INDEX "TransportOwnerVehicle_vehicleNumber_idx" ON "TransportOwnerVehicle"("vehicleNumber");

-- CreateIndex
CREATE INDEX "MaterialTypeDefinition_name_idx" ON "MaterialTypeDefinition"("name");

-- CreateIndex
CREATE INDEX "MaterialRate_ratePartyType_ratePartyId_idx" ON "MaterialRate"("ratePartyType", "ratePartyId");

-- CreateIndex
CREATE INDEX "AdvanceRecord_date_idx" ON "AdvanceRecord"("date");

-- CreateIndex
CREATE INDEX "AdvanceRecord_ratePartyType_ratePartyId_idx" ON "AdvanceRecord"("ratePartyType", "ratePartyId");

-- CreateIndex
CREATE INDEX "DailyExpenseRecord_date_idx" ON "DailyExpenseRecord"("date");

-- CreateIndex
CREATE INDEX "DailyExpenseRecord_from_idx" ON "DailyExpenseRecord"("from");

-- CreateIndex
CREATE UNIQUE INDEX "DailyExpenseOpeningBalance_supervisorName_key" ON "DailyExpenseOpeningBalance"("supervisorName");

-- CreateIndex
CREATE INDEX "TripRecord_date_idx" ON "TripRecord"("date");

-- CreateIndex
CREATE INDEX "TripRecord_vehicleNumber_idx" ON "TripRecord"("vehicleNumber");

-- CreateIndex
CREATE INDEX "NotificationRecord_timestamp_idx" ON "NotificationRecord"("timestamp");

-- CreateIndex
CREATE INDEX "NotificationRecord_targetRole_idx" ON "NotificationRecord"("targetRole");

-- CreateIndex
CREATE INDEX "NotificationRecord_targetUser_idx" ON "NotificationRecord"("targetUser");

-- CreateIndex
CREATE INDEX "NotificationRecord_tripId_idx" ON "NotificationRecord"("tripId");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_merchantTypeId_fkey" FOREIGN KEY ("merchantTypeId") REFERENCES "MerchantType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantBankAccount" ADD CONSTRAINT "MerchantBankAccount_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineQuarry" ADD CONSTRAINT "MineQuarry_merchantTypeId_fkey" FOREIGN KEY ("merchantTypeId") REFERENCES "MerchantType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineQuarry" ADD CONSTRAINT "MineQuarry_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCustomer" ADD CONSTRAINT "VendorCustomer_merchantTypeId_fkey" FOREIGN KEY ("merchantTypeId") REFERENCES "MerchantType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCustomer" ADD CONSTRAINT "VendorCustomer_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyOwnerProfile" ADD CONSTRAINT "RoyaltyOwnerProfile_merchantTypeId_fkey" FOREIGN KEY ("merchantTypeId") REFERENCES "MerchantType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyOwnerProfile" ADD CONSTRAINT "RoyaltyOwnerProfile_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportOwnerProfile" ADD CONSTRAINT "TransportOwnerProfile_merchantTypeId_fkey" FOREIGN KEY ("merchantTypeId") REFERENCES "MerchantType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportOwnerProfile" ADD CONSTRAINT "TransportOwnerProfile_siteLocationId_fkey" FOREIGN KEY ("siteLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportOwnerVehicle" ADD CONSTRAINT "TransportOwnerVehicle_transportOwnerId_fkey" FOREIGN KEY ("transportOwnerId") REFERENCES "TransportOwnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRate" ADD CONSTRAINT "MaterialRate_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRate" ADD CONSTRAINT "MaterialRate_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRate" ADD CONSTRAINT "MaterialRate_dropOffLocationId_fkey" FOREIGN KEY ("dropOffLocationId") REFERENCES "SiteLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
