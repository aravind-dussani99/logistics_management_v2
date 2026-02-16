-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "PaymentRecord_paymentNumber_seq";

-- AlterTable
ALTER TABLE "PaymentRecord"
ADD COLUMN "paymentNumber" INTEGER;

-- Backfill existing records with stable sequential values
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_num
  FROM "PaymentRecord"
)
UPDATE "PaymentRecord" p
SET "paymentNumber" = ranked.row_num
FROM ranked
WHERE p."id" = ranked."id";

-- Set sequence default for future inserts
ALTER TABLE "PaymentRecord"
ALTER COLUMN "paymentNumber" SET DEFAULT nextval('"PaymentRecord_paymentNumber_seq"');

-- Ensure next generated value starts after current max
SELECT setval(
  '"PaymentRecord_paymentNumber_seq"',
  COALESCE((SELECT MAX("paymentNumber") FROM "PaymentRecord"), 0) + 1,
  false
);

-- Enforce constraints
ALTER TABLE "PaymentRecord"
ALTER COLUMN "paymentNumber" SET NOT NULL;

CREATE UNIQUE INDEX "PaymentRecord_paymentNumber_key" ON "PaymentRecord"("paymentNumber");
