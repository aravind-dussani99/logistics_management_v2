-- AlterTable
ALTER TABLE "PaymentRecord" ADD COLUMN     "bankAccountUploads" JSONB,
ADD COLUMN     "paymentReceiptUploads" JSONB;
