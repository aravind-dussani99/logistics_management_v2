/*
  Warnings:

  - You are about to drop the column `siteExpense` on the `PaymentRecord` table. All the data in the column will be lost.
  - Made the column `ratePartyType` on table `PaymentRecord` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ratePartyId` on table `PaymentRecord` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PaymentRecord" DROP COLUMN "siteExpense",
ADD COLUMN     "paymentReceiptUpload" TEXT;
