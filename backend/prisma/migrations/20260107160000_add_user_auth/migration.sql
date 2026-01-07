-- Create enum for user roles
CREATE TYPE "UserRole" AS ENUM (
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'PICKUP_SUPERVISOR',
  'DROPOFF_SUPERVISOR',
  'GUEST'
);

-- Create users table
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "avatarUrl" TEXT,
  "pickupLocationId" TEXT,
  "dropOffLocationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Unique and index constraints
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_role_idx" ON "User"("role");

-- Foreign keys to site locations
ALTER TABLE "User" ADD CONSTRAINT "User_pickupLocationId_fkey"
  FOREIGN KEY ("pickupLocationId") REFERENCES "SiteLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_dropOffLocationId_fkey"
  FOREIGN KEY ("dropOffLocationId") REFERENCES "SiteLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
