-- CreateEnum
CREATE TYPE "HeroCardKey" AS ENUM ('earn', 'biawin', 'reward');

-- CreateEnum
CREATE TYPE "HeroCardColor" AS ENUM ('blue', 'sky', 'white');

-- CreateEnum
CREATE TYPE "BannerTheme" AS ENUM ('auto', 'home', 'fashion', 'gold', 'travel');

-- CreateEnum
CREATE TYPE "MosaicSlot" AS ENUM ('half', 'wide');

-- CreateEnum
CREATE TYPE "MosaicTheme" AS ENUM ('beauty', 'insurance', 'home', 'digital');

-- CreateTable
CREATE TABLE "home_hero_cards" (
    "id" TEXT NOT NULL,
    "cardKey" "HeroCardKey" NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "displayNumber" TEXT NOT NULL,
    "ownerLabel" TEXT NOT NULL,
    "colorPreset" "HeroCardColor" NOT NULL DEFAULT 'blue',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_hero_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_service_banners" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "kicker" TEXT NOT NULL,
    "theme" "BannerTheme" NOT NULL DEFAULT 'auto',
    "wide" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_service_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_service_mosaic_tiles" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "slotType" "MosaicSlot" NOT NULL,
    "kicker" TEXT NOT NULL,
    "title" TEXT,
    "lead" TEXT,
    "theme" "MosaicTheme" NOT NULL DEFAULT 'home',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_service_mosaic_tiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_news_articles" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "kicker" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "bodySlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_hero_cards_cardKey_key" ON "home_hero_cards"("cardKey");

-- CreateIndex
CREATE INDEX "home_hero_cards_active_sortOrder_idx" ON "home_hero_cards"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "home_service_banners_active_sortOrder_idx" ON "home_service_banners"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "home_service_mosaic_tiles_active_slotType_sortOrder_idx" ON "home_service_mosaic_tiles"("active", "slotType", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "home_news_articles_bodySlug_key" ON "home_news_articles"("bodySlug");

-- CreateIndex
CREATE INDEX "home_news_articles_active_sortOrder_idx" ON "home_news_articles"("active", "sortOrder");

-- AddForeignKey
ALTER TABLE "home_hero_cards" ADD CONSTRAINT "home_hero_cards_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_hero_cards" ADD CONSTRAINT "home_hero_cards_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_banners" ADD CONSTRAINT "home_service_banners_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_banners" ADD CONSTRAINT "home_service_banners_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_banners" ADD CONSTRAINT "home_service_banners_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_banners" ADD CONSTRAINT "home_service_banners_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_mosaic_tiles" ADD CONSTRAINT "home_service_mosaic_tiles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_mosaic_tiles" ADD CONSTRAINT "home_service_mosaic_tiles_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_mosaic_tiles" ADD CONSTRAINT "home_service_mosaic_tiles_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_mosaic_tiles" ADD CONSTRAINT "home_service_mosaic_tiles_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_news_articles" ADD CONSTRAINT "home_news_articles_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_news_articles" ADD CONSTRAINT "home_news_articles_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_news_articles" ADD CONSTRAINT "home_news_articles_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
