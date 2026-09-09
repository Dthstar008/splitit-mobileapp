-- CreateEnum
CREATE TYPE "HashAlgorithm" AS ENUM ('SHA256_LEGACY', 'BCRYPT');

-- CreateEnum
CREATE TYPE "BasketStatus" AS ENUM ('draft', 'active', 'fully_settled', 'pending_payments');

-- CreateEnum
CREATE TYPE "PayerStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('applied', 'underpaid', 'ignored');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "hashAlgorithm" "HashAlgorithm" NOT NULL DEFAULT 'BCRYPT',
    "splitId" TEXT NOT NULL,
    "payoutBankName" TEXT,
    "payoutAccountNumber" TEXT,
    "payoutAccountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baskets" (
    "id" TEXT NOT NULL,
    "textCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalMarketCost" DECIMAL(12,2) NOT NULL,
    "status" "BasketStatus" NOT NULL DEFAULT 'pending_payments',
    "qrPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,

    CONSTRAINT "baskets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "basket_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "basketId" TEXT NOT NULL,

    CONSTRAINT "basket_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "splitId" TEXT,
    "shareAmount" DECIMAL(12,2) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "totalDue" DECIMAL(12,2) NOT NULL,
    "status" "PayerStatus" NOT NULL DEFAULT 'pending',
    "virtualAccountNumber" TEXT,
    "virtualAccountBank" TEXT,
    "virtualAccountExpiresAt" TIMESTAMP(3),
    "basketId" TEXT NOT NULL,

    CONSTRAINT "payers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "paystackReference" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "status" "PaymentEventStatus" NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "basketId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_splitId_key" ON "users"("splitId");

-- CreateIndex
CREATE UNIQUE INDEX "baskets_textCode_key" ON "baskets"("textCode");

-- CreateIndex
CREATE INDEX "baskets_adminId_idx" ON "baskets"("adminId");

-- CreateIndex
CREATE INDEX "payers_basketId_idx" ON "payers"("basketId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_paystackReference_key" ON "payment_events"("paystackReference");

-- CreateIndex
CREATE INDEX "payment_events_basketId_idx" ON "payment_events"("basketId");

-- AddForeignKey
ALTER TABLE "baskets" ADD CONSTRAINT "baskets_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "baskets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payers" ADD CONSTRAINT "payers_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "baskets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "baskets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "payers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
