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

// Deliberately anchored on `process.cwd()`, not `__dirname` — this script is
// invoked two different ways with two different `__dirname`s (`ts-node` from
// `backend/prisma/` in local dev, `node` against the compiled
// `backend/dist/prisma/` in staging/production — see deploy.sh), but both
// invocations are always run with cwd = `backend/` (pnpm's `--filter` and
// deploy.sh's `cd backend &&` both guarantee this), so this is the one
// anchor that's invariant across both.
const WEB_PUBLIC_HOME = join(process.cwd(), '..', 'apps', 'web', 'public', 'home');

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
      let asset;
      try {
        asset = await mediaService.upload(
          { originalname: fileName, mimetype: 'image/webp', size: buffer.length, buffer },
          { altText: row.label },
          admin.id,
          {},
        );
      } catch (error: unknown) {
        // Fails fast with an ACTIONABLE message on the very first upload
        // instead of an opaque AWS SDK stack trace repeated per file — this
        // exact class of error (SignatureDoesNotMatch/403) is what broke
        // real staging (Stage 5.22): STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY
        // didn't match MinIO's actual root credentials. Fixed at the
        // infrastructure level (docker-compose.staging.yml now derives both
        // from MINIO_ROOT_USER/MINIO_ROOT_PASSWORD, so this specific cause
        // is now structurally impossible there) — this check is defense in
        // depth for any OTHER way object-storage credentials could still be
        // wrong (a real credential rotation, a non-Docker invocation, a
        // different environment entirely).
        const name = (error as { name?: string; Code?: string })?.name ?? '';
        const code = (error as { Code?: string })?.Code ?? '';
        const status = (error as { $metadata?: { httpStatusCode?: number } })
          ?.$metadata?.httpStatusCode;
        const looksLikeAuthFailure =
          /Signature|AccessDenied|InvalidAccessKeyId/i.test(name || code) ||
          status === 403;
        if (looksLikeAuthFailure) {
          console.error(
            `\nObject storage authentication failed (${name || code || status}) while uploading "${fileName}".\n` +
              'This looks like STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY not matching the object storage\n' +
              "server's actual credentials — see docs/08-staging-deployment.md \"MinIO/S3 credential\n" +
              'consistency" for how staging derives these and why they must never be set independently.',
          );
        }
        throw error;
      }
      await target.updateRow(prisma, row.id, asset.id, admin.id);
      console.log(`  [linked] ${row.label} -> ${asset.url}`);
    }
  }

  console.log('\nDone.');
  await app.close();
  // `app.close()` runs Nest's lifecycle hooks but doesn't guarantee every
  // provider's underlying handle is released (found the hard way: MinIO's
  // S3 client keeps an HTTP keep-alive socket open, which leaves the event
  // loop non-empty and this process hanging forever after logging "Done." —
  // fatal under `docker compose run --rm`, which waits for the container's
  // own process to exit). A one-off script that has finished its single job
  // should not depend on every dependency's cleanup being exhaustive.
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
