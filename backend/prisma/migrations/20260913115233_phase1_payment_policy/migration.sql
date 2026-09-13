-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayerStatus" ADD VALUE 'underpaid';
ALTER TYPE "PayerStatus" ADD VALUE 'refunded';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentEventStatus" ADD VALUE 'overpaid';
ALTER TYPE "PaymentEventStatus" ADD VALUE 'refunded';

-- AlterTable
ALTER TABLE "payers" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0;
