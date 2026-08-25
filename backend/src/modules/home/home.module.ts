import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { MediaModule } from '../media/media.module';
import { HomeHeroCardsAdminController } from './home-hero-cards-admin.controller';
import { HomeHeroCardsController } from './home-hero-cards.controller';
import { HomeHeroCardsService } from './home-hero-cards.service';
import { HomeNewsArticlesAdminController } from './home-news-articles-admin.controller';
import { HomeNewsArticlesController } from './home-news-articles.controller';
import { HomeNewsArticlesService } from './home-news-articles.service';
import { HomeServiceBannersAdminController } from './home-service-banners-admin.controller';
import { HomeServiceBannersController } from './home-service-banners.controller';
import { HomeServiceBannersService } from './home-service-banners.service';
import { HomeServiceMosaicTilesAdminController } from './home-service-mosaic-tiles-admin.controller';
import { HomeServiceMosaicTilesController } from './home-service-mosaic-tiles.controller';
import { HomeServiceMosaicTilesService } from './home-service-mosaic-tiles.service';

/**
 * 4 resources (docs/home-admin-contract.md §4.3–§4.6), each its own
 * service + a public controller (`/home/**`, `@Public()`) + an admin
 * controller (`/admin/home/**`, `AdminJwtAuthGuard`/`AdminRolesGuard`) —
 * not a generic CRUD module, per ADR §9. `MediaStorageService` comes from
 * `StorageModule`'s global export chain via `MediaModule` — imported here
 * directly since 3 of the 4 services resolve a `mediaAsset` relation to a
 * public URL the same way `MediaService` does.
 */
@Module({
  imports: [AdminAuditLogModule, MediaModule],
  controllers: [
    HomeHeroCardsController,
    HomeHeroCardsAdminController,
    HomeServiceBannersController,
    HomeServiceBannersAdminController,
    HomeServiceMosaicTilesController,
    HomeServiceMosaicTilesAdminController,
    HomeNewsArticlesController,
    HomeNewsArticlesAdminController,
  ],
  providers: [
    HomeHeroCardsService,
    HomeServiceBannersService,
    HomeServiceMosaicTilesService,
    HomeNewsArticlesService,
  ],
})
export class HomeModule {}
