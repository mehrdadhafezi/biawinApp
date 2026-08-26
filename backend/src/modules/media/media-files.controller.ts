import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

/**
 * The static-bridge serving route `MediaStorageService.resolvePublicUrl()`
 * has always promised (`/media/{filename}`) but that never actually
 * existed until Stage 5.21 needed a real, browser-loadable image for
 * Customer Home — see `media-storage.service.ts`'s own doc comment.
 * `@Public()` (customer-app global guard opt-out) + no admin guard at all:
 * this must be reachable by any unauthenticated visitor, same as the
 * images themselves are meant to be public.
 *
 * `key = media/{filename}` is reconstructed directly rather than looked up
 * by filename alone (`buildKey()` always produces exactly `media/<uuid>.<ext>`,
 * so the mapping is deterministic) — but the `MediaAsset` row is still
 * looked up by that key to (a) confirm it's `active` (a soft-deleted asset
 * must not still be servable by guessing its old filename) and (b) serve
 * the real stored `mimeType` rather than trusting whatever Content-Type
 * the object store happens to report.
 *
 * `Cross-Origin-Resource-Policy: cross-origin` is set explicitly, overriding
 * `helmet()`'s global default (`same-origin`, applied in `main.ts` to every
 * response) — found live during Stage 5.21 verification: with the default,
 * `fetch()` against this route succeeds (CORP doesn't gate `fetch`), but a
 * real `<img src="http://api-origin/...">` from a *different* origin
 * (`apps/web` on its own port/domain, always true in every real deployment)
 * silently fails to decode — no network error, no console error, just a
 * permanently broken image. This route's entire purpose is being embedded
 * cross-origin as an image, so relaxing CORP here (and only here, not
 * globally) is the correct fix, not a security regression — the JSON API's
 * other routes keep helmet's default.
 */
@ApiTags('media-files')
@Public()
@Controller({ path: 'media', version: '1' })
export class MediaFilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get(':filename')
  async serve(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `media/${filename}`;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { key, active: true },
    });
    if (!asset) throw new NotFoundException('رسانه یافت نشد.');

    const object = await this.storage.getObject(key);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(object.body);
  }
}
