/*
  Warnings:

  - You are about to drop the column `counterpartyName` on the `PaymentRecord` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `PaymentRecord` table. All the data in the column will be lost.
  - You are about to drop the column `paymentReceiptUpload` on the `PaymentRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PaymentRecord" DROP COLUMN "counterpartyName",
DROP COLUMN "method",
DROP COLUMN "paymentReceiptUpload",
ADD COLUMN     "ratePartyName" TEXT;
