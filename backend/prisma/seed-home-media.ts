/**
 * Stage 5.21 — links the real, visually-approved static images under
 * `apps/web/public/home/{banners,mosaic,news}/` to their corresponding
 * Stage 5.19 Home CMS rows, so Customer Home can finally render real
 * `MediaAsset`-backed images instead of `image: null` (every row seeded by
 * `seed.ts` left `mediaAssetId` unset on purpose — see that file's own
 * comment: "connecting them is explicitly out of scope this stage").
 *
 * Deliberately goes through the real `MediaService.upload()` (via a
 * bootstrapped Nest application context, not a raw script reimplementing
 * storage/validation logic) — the same rule Stage 5.20 held for the Admin
 * UI applies here: never bypass `MediaService`/`MediaStorageService`.
 *
 * Idempotent: a row whose `mediaAssetId` is already set is left untouched
 * (re-running this script after a partial run, or after Admin has since
 * changed a row's image by hand, never clobbers it). Matches files to rows
 * by array position within each resource's `sortOrder`-ascending list —
 * safe because both the static files (`item-01.webp`, `item-02.webp`, ...)
 * and the seeded CMS rows were populated from the exact same source array
 * in `apps/web/src/components/home/home.mock.ts`, in the same order (see
 * `docs/home-cms-parity-audit.md` for the row-by-row verification).
 *
 * Run with: `pnpm --filter @biawin/backend exec ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-home-media.ts`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { MediaService } from '../src/modules/media/media.service';

const WEB_PUBLIC_HOME = join(__dirname, '..', '..', 'apps', 'web', 'public', 'home');

interface MigrationTarget {
  /** Absolute path to the static file, in the same order as the sorted CMS rows. */
  files: string[];
  /** Fetches CMS rows already ordered by `sortOrder` ascending — same order the files above assume. */
  listRows: (prisma: PrismaService) => Promise<{ id: string; mediaAssetId: string | null; label: string }[]>;
  updateRow: (prisma: PrismaService, id: string, mediaAssetId: string, adminUserId: string) => Promise<void>;
}

function filesFor(dir: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => join(WEB_PUBLIC_HOME, dir, `item-${String(i + 1).padStart(2, '0')}.webp`));
}

const TARGETS: Record<string, MigrationTarget> = {
  'خدمات منتخب بیاوین (service banners)': {
    files: filesFor('banners', 5),
    listRows: (prisma) =>
      prisma.homeServiceBanner.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { category: true },
      }).then((rows) => rows.map((r) => ({ id: r.id, mediaAssetId: r.mediaAssetId, label: r.category.name }))),
    updateRow: (prisma, id, mediaAssetId, adminUserId) =>
      prisma.homeServiceBanner
        .update({ where: { id }, data: { mediaAssetId, updatedBy: adminUserId } })
        .then(() => undefined),
  },
  'موزاییک خدمات (service mosaic tiles)': {
    files: filesFor('mosaic', 4),
    listRows: (prisma) =>
      prisma.homeServiceMosaicTile.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { category: true },
      }).then((rows) => rows.map((r) => ({ id: r.id, mediaAssetId: r.mediaAssetId, label: r.category.name }))),
    updateRow: (prisma, id, mediaAssetId, adminUserId) =>
      prisma.homeServiceMosaicTile
        .update({ where: { id }, data: { mediaAssetId, updatedBy: adminUserId } })
        .then(() => undefined),
  },
  'اخبار (news articles)': {
    files: filesFor('news', 8),
    listRows: (prisma) =>
      prisma.homeNewsArticle
        .findMany({ orderBy: { sortOrder: 'asc' } })
        .then((rows) => rows.map((r) => ({ id: r.id, mediaAssetId: r.mediaAssetId, label: r.title }))),
    updateRow: (prisma, id, mediaAssetId, adminUserId) =>
      prisma.homeNewsArticle
        .update({ where: { id }, data: { mediaAssetId, updatedBy: adminUserId } })
        .then(() => undefined),
  },
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const mediaService = app.get(MediaService);

  const admin = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.error('No SUPER_ADMIN found — run `prisma db seed` first.');
    await app.close();
    process.exit(1);
  }

  for (const [label, target] of Object.entries(TARGETS)) {
    console.log(`\n${label}`);
    const rows = await target.listRows(prisma);

    if (rows.length !== target.files.length) {
      console.warn(
        `  Row/file count mismatch (${rows.length} rows, ${target.files.length} files) — skipping this resource, check seed data before re-running.`,
      );
      continue;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const filePath = target.files[i];

      if (row.mediaAssetId) {
        console.log(`  [skip, already linked] ${row.label}`);
        continue;
      }

      const buffer = readFileSync(filePath);
      const fileName = filePath.split(/[/\\]/).pop()!;
      const asset = await mediaService.upload(
        { originalname: fileName, mimetype: 'image/webp', size: buffer.length, buffer },
        { altText: row.label },
        admin.id,
        {},
      );
      await target.updateRow(prisma, row.id, asset.id, admin.id);
      console.log(`  [linked] ${row.label} -> ${asset.url}`);
    }
  }

  console.log('\nDone.');
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
