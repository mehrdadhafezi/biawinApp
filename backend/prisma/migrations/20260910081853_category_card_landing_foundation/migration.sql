-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "category_cards" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "targetServiceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "badge" TEXT,
    "mediaAssetId" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_cards_categoryId_active_sortOrder_idx" ON "category_cards"("categoryId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "category_cards_targetServiceId_idx" ON "category_cards"("targetServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- AddForeignKey
ALTER TABLE "category_cards" ADD CONSTRAINT "category_cards_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_cards" ADD CONSTRAINT "category_cards_targetServiceId_fkey" FOREIGN KEY ("targetServiceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_cards" ADD CONSTRAINT "category_cards_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_cards" ADD CONSTRAINT "category_cards_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_cards" ADD CONSTRAINT "category_cards_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

