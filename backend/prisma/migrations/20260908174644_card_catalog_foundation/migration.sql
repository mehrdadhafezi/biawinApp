-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT_CARD', 'DISCOUNT_CARD', 'SUBSCRIPTION', 'VOUCHER', 'INSTALLMENT_CARD');

-- CreateEnum
CREATE TYPE "JourneyType" AS ENUM ('PURCHASE', 'CREDIT_REQUEST', 'LEAD', 'EXTERNAL_REDIRECT', 'QUOTE_REQUEST', 'FREE_SERVICE');

-- CreateEnum
CREATE TYPE "CustomerCardStatus" AS ENUM ('CREATED', 'PURCHASED', 'ACTIVE', 'PARTIALLY_USED', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UsageSource" AS ENUM ('API', 'WEBHOOK', 'MANUAL');

-- CreateTable
CREATE TABLE "card_products" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageKey" TEXT,
    "badge" TEXT,
    "cardType" "CardType" NOT NULL,
    "journeyType" "JourneyType" NOT NULL,
    "priceAmount" INTEGER,
    "priceLabel" TEXT,
    "benefits" JSONB NOT NULL,
    "validityDays" INTEGER,
    "providerConfig" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_card_instances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardProductId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "CustomerCardStatus" NOT NULL DEFAULT 'CREATED',
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_card_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_transactions" (
    "id" TEXT NOT NULL,
    "customerCardInstanceId" TEXT NOT NULL,
    "amount" INTEGER,
    "description" TEXT NOT NULL,
    "source" "UsageSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_products_serviceId_idx" ON "card_products"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_card_instances_orderId_key" ON "customer_card_instances"("orderId");

-- CreateIndex
CREATE INDEX "customer_card_instances_userId_status_idx" ON "customer_card_instances"("userId", "status");

-- CreateIndex
CREATE INDEX "usage_transactions_customerCardInstanceId_createdAt_idx" ON "usage_transactions"("customerCardInstanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "card_products" ADD CONSTRAINT "card_products_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_card_instances" ADD CONSTRAINT "customer_card_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_card_instances" ADD CONSTRAINT "customer_card_instances_cardProductId_fkey" FOREIGN KEY ("cardProductId") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_card_instances" ADD CONSTRAINT "customer_card_instances_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_transactions" ADD CONSTRAINT "usage_transactions_customerCardInstanceId_fkey" FOREIGN KEY ("customerCardInstanceId") REFERENCES "customer_card_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

