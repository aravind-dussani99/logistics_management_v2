ALTER TABLE "User"
  ADD COLUMN "mobileNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "email" TEXT,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "postalCode" TEXT;
