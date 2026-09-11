-- AlterTable
ALTER TABLE "card_products" ADD COLUMN     "mediaAssetId" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "mediaAssetId" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "description" TEXT,
ADD COLUMN     "galleryMediaAssetIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "mediaAssetId" TEXT,
ADD COLUMN     "terms" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "usageGuide" JSONB NOT NULL DEFAULT '[]';

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_products" ADD CONSTRAINT "card_products_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

