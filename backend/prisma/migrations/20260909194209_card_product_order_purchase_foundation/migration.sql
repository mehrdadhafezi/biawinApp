-- CreateEnum
CREATE TYPE "CardValueDisplayType" AS ENUM ('FIXED', 'UP_TO');

-- AlterTable
ALTER TABLE "card_products" ADD COLUMN     "valueAmount" INTEGER,
ADD COLUMN     "valueDisplayType" "CardValueDisplayType";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cardProductId" TEXT,
ALTER COLUMN "method" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "orders_cardProductId_idx" ON "orders"("cardProductId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cardProductId_fkey" FOREIGN KEY ("cardProductId") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
