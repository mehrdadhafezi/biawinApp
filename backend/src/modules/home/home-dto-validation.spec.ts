import { ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHomeNewsArticleDto } from './dto/create-home-news-article.dto';
import { CreateHomeServiceBannerDto } from './dto/create-home-service-banner.dto';
import { CreateHomeServiceMosaicTileDto } from './dto/create-home-service-mosaic-tile.dto';
import { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import { UpdateHomeHeroCardDto } from './dto/update-home-hero-card.dto';
import { UpdateHomeNewsArticleDto } from './dto/update-home-news-article.dto';
import { UpdateHomeServiceBannerDto } from './dto/update-home-service-banner.dto';
import { UpdateHomeServiceMosaicTileDto } from './dto/update-home-service-mosaic-tile.dto';
import { HomeHeroCardsAdminController } from './home-hero-cards-admin.controller';
import { HomeNewsArticlesAdminController } from './home-news-articles-admin.controller';
import { HomeServiceBannersAdminController } from './home-service-banners-admin.controller';
import { HomeServiceMosaicTilesAdminController } from './home-service-mosaic-tiles-admin.controller';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

/** Same pipeline settings as `main.ts` (whitelist + forbidNonWhitelisted + transform + implicit conversion). */
async function check<T extends object>(cls: new () => T, payload: unknown) {
  const instance = plainToInstance(cls, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, errors, ok: errors.length === 0 };
}

describe('Home DTO validation (Stage 5.16-B §4)', () => {
  describe('Admin-app payload compatibility — payloads the existing forms generate must stay valid', () => {
    it('banner create: mediaAssetId null (no image yet)', async () => {
      const r = await check(CreateHomeServiceBannerDto, {
        categoryId: U1,
        mediaAssetId: null,
        kicker: 'اعتبار و اقساط',
        theme: 'auto',
        wide: false,
        active: true,
      });
      expect(r.errors).toEqual([]);
    });

    it('mosaic create: mediaAssetId/title/lead all null (BD-5: title & lead stay optional)', async () => {
      const r = await check(CreateHomeServiceMosaicTileDto, {
        categoryId: U1,
        mediaAssetId: null,
        slotType: 'wide',
        kicker: 'بیمه',
        title: null,
        lead: null,
        theme: 'insurance',
        active: true,
      });
      expect(r.errors).toEqual([]);
    });

    it('mosaic: blank title/lead normalize to null (what the form means by blank)', async () => {
      const r = await check(UpdateHomeServiceMosaicTileDto, {
        title: '   ',
        lead: '',
      });
      expect(r.errors).toEqual([]);
      expect(r.instance.title).toBeNull();
      expect(r.instance.lead).toBeNull();
    });

    it('news create/update: mediaAssetId null and bodySlug null', async () => {
      const create = await check(CreateHomeNewsArticleDto, {
        category: 'اخبار',
        mediaAssetId: null,
        kicker: 'k',
        title: 't',
        lead: 'l',
        bodySlug: null,
        active: true,
      });
      expect(create.errors).toEqual([]);
      const update = await check(UpdateHomeNewsArticleDto, {
        mediaAssetId: null,
        bodySlug: null,
      });
      expect(update.errors).toEqual([]);
    });

    it('hero update with the whole form and `{ active }` alone (toggle) are both valid', async () => {
      expect(
        (
          await check(UpdateHomeHeroCardDto, {
            cardKey: 'biawin',
            label: 'کارت',
            title: 'عنوان',
            subtitle: 'زیرعنوان',
            displayNumber: '5029 0801 5538 7421',
            ownerLabel: 'BIAWIN',
            colorPreset: 'white',
            active: false,
          })
        ).errors,
      ).toEqual([]);
      expect(
        (await check(UpdateHomeHeroCardDto, { active: false })).errors,
      ).toEqual([]);
      expect(
        (await check(UpdateHomeServiceBannerDto, { active: true })).errors,
      ).toEqual([]);
    });

    it('QA-runner style sortOrder 9999 stays valid', async () => {
      const r = await check(CreateHomeServiceBannerDto, {
        categoryId: U1,
        kicker: 'qa',
        sortOrder: 9999,
      });
      expect(r.errors).toEqual([]);
    });
  });

  describe('text rules', () => {
    it('trims surrounding whitespace', async () => {
      const r = await check(CreateHomeServiceBannerDto, {
        categoryId: U1,
        kicker: '  سلام  ',
      });
      expect(r.errors).toEqual([]);
      expect(r.instance.kicker).toBe('سلام');
    });

    it.each(['', '   '])(
      'rejects a required text of %j (create and update)',
      async (blank) => {
        expect(
          (
            await check(CreateHomeServiceBannerDto, {
              categoryId: U1,
              kicker: blank,
            })
          ).ok,
        ).toBe(false);
        expect(
          (await check(UpdateHomeServiceBannerDto, { kicker: blank })).ok,
        ).toBe(false);
        expect((await check(UpdateHomeHeroCardDto, { title: blank })).ok).toBe(
          false,
        );
        expect(
          (await check(UpdateHomeNewsArticleDto, { lead: blank })).ok,
        ).toBe(false);
      },
    );

    it('rejects over-length text (limits are >= 2x the largest staging value)', async () => {
      expect(
        (
          await check(CreateHomeServiceBannerDto, {
            categoryId: U1,
            kicker: 'ا'.repeat(201),
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await check(CreateHomeServiceBannerDto, {
            categoryId: U1,
            kicker: 'ا'.repeat(200),
          })
        ).ok,
      ).toBe(true);
      expect(
        (await check(UpdateHomeNewsArticleDto, { lead: 'ا'.repeat(1001) })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceMosaicTileDto, { lead: 'ا'.repeat(501) }))
          .ok,
      ).toBe(false);
    });

    it('rejects unknown properties', async () => {
      expect((await check(UpdateHomeServiceBannerDto, { bogus: 1 })).ok).toBe(
        false,
      );
    });

    it('rejects an explicit null on NOT NULL fields (was a 500 from Prisma; now a 400)', async () => {
      expect(
        (await check(UpdateHomeServiceBannerDto, { kicker: null })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceBannerDto, { theme: null })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceBannerDto, { active: null })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceBannerDto, { sortOrder: null })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceBannerDto, { categoryId: null })).ok,
      ).toBe(false);
      expect(
        (
          await check(CreateHomeServiceBannerDto, {
            categoryId: U1,
            kicker: 'k',
            wide: null,
          })
        ).ok,
      ).toBe(false);
    });

    it('bodySlug: lowercase slug accepted, blank → null, bad format rejected', async () => {
      expect(
        (
          await check(UpdateHomeNewsArticleDto, {
            bodySlug: 'spring-sale-2026',
          })
        ).ok,
      ).toBe(true);
      const blank = await check(UpdateHomeNewsArticleDto, { bodySlug: ' ' });
      expect(blank.ok).toBe(true);
      expect(blank.instance.bodySlug).toBeNull();
      for (const bad of [
        'Has Space',
        'UPPER',
        'a--b',
        '-a',
        'a-',
        'x'.repeat(101),
      ]) {
        expect(
          (await check(UpdateHomeNewsArticleDto, { bodySlug: bad })).ok,
        ).toBe(false);
      }
    });
  });

  describe('uuid, enum and numeric rules', () => {
    it('malformed categoryId / mediaAssetId → invalid', async () => {
      expect(
        (
          await check(CreateHomeServiceBannerDto, {
            categoryId: 'not-a-uuid',
            kicker: 'k',
          })
        ).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceBannerDto, { categoryId: '' })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeServiceBannerDto, { mediaAssetId: 'nope' })).ok,
      ).toBe(false);
      expect(
        (await check(UpdateHomeNewsArticleDto, { mediaAssetId: 'nope' })).ok,
      ).toBe(false);
    });

    it('invalid enums → invalid', async () => {
      expect((await check(UpdateHomeHeroCardDto, { cardKey: 'nope' })).ok).toBe(
        false,
      );
      expect(
        (await check(UpdateHomeHeroCardDto, { colorPreset: 'red' })).ok,
      ).toBe(false);
      expect((await check(UpdateHomeServiceBannerDto, { theme: 'x' })).ok).toBe(
        false,
      );
      expect(
        (
          await check(CreateHomeServiceMosaicTileDto, {
            categoryId: U1,
            kicker: 'k',
            slotType: 'huge',
          })
        ).ok,
      ).toBe(false);
    });

    it.each([
      [-1, false],
      [0, true],
      [100000, true],
      [100001, false],
      [1.5, false],
    ])('sortOrder %p valid=%p', async (value, valid) => {
      expect(
        (await check(UpdateHomeServiceBannerDto, { sortOrder: value })).ok,
      ).toBe(valid);
    });
  });

  describe('ReorderHomeItemsDto — payload rules (all 400 at the pipe, before any write)', () => {
    const entry = (id: string, sortOrder: number) => ({ id, sortOrder });

    it('accepts a single-item partial payload and a two-row swap (Stage 5.22 QA shapes)', async () => {
      expect(
        (await check(ReorderHomeItemsDto, { items: [entry(U1, 9998)] })).errors,
      ).toEqual([]);
      expect(
        (
          await check(ReorderHomeItemsDto, {
            items: [entry(U1, 1), entry(U2, 0)],
          })
        ).errors,
      ).toEqual([]);
    });

    it('rejects empty payload, missing items and non-arrays', async () => {
      expect((await check(ReorderHomeItemsDto, { items: [] })).ok).toBe(false);
      expect((await check(ReorderHomeItemsDto, {})).ok).toBe(false);
      expect((await check(ReorderHomeItemsDto, { items: 'x' })).ok).toBe(false);
    });

    it('rejects a malformed uuid', async () => {
      expect(
        (await check(ReorderHomeItemsDto, { items: [entry('banner-1', 0)] }))
          .ok,
      ).toBe(false);
    });

    it('rejects duplicate ids', async () => {
      const r = await check(ReorderHomeItemsDto, {
        items: [entry(U1, 0), entry(U1, 1)],
      });
      expect(r.ok).toBe(false);
    });

    it('rejects duplicate positions', async () => {
      const r = await check(ReorderHomeItemsDto, {
        items: [entry(U1, 3), entry(U2, 3)],
      });
      expect(r.ok).toBe(false);
    });

    it('rejects negative / non-integer / too-large positions', async () => {
      for (const sortOrder of [-1, 0.5, 100001]) {
        expect(
          (
            await check(ReorderHomeItemsDto, {
              items: [entry(U1, sortOrder), entry(U2, 5), entry(U3, 6)],
            })
          ).ok,
        ).toBe(false);
      }
    });
  });

  describe('ParseUUIDPipe on every admin :id route', () => {
    const controllers = [
      HomeHeroCardsAdminController,
      HomeServiceBannersAdminController,
      HomeServiceMosaicTilesAdminController,
      HomeNewsArticlesAdminController,
    ];

    it.each(controllers.map((c) => [c.name, c] as const))(
      '%s: findOne/update/remove reject a malformed id before reaching Prisma',
      (_name, Controller) => {
        for (const method of ['findOne', 'update', 'remove']) {
          const args = Reflect.getMetadata(
            ROUTE_ARGS_METADATA,
            Controller,
            method,
          ) as Record<string, { data: string; pipes: unknown[] }>;
          const idArg = Object.values(args).find((a) => a.data === 'id');
          expect(idArg?.pipes).toContain(ParseUUIDPipe);
        }
      },
    );
  });
});
