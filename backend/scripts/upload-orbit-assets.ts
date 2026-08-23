/**
 * One-time script: uploads the 11 real, QA'd Orbit assets from
 * apps/web/public/orbit/ into object storage (MinIO/S3), keyed as
 * "orbit/{filename}" — matching prisma/seed.ts's OrbitItem.imageKey values.
 *
 * Not part of `prisma db seed`: seed.ts uses a plain PrismaClient with no
 * NestJS DI, so it can't reach StorageService, and the backend Docker image
 * doesn't COPY apps/web/public/ into its build context. Run this by hand,
 * against dev or staging, whenever the object storage bucket needs
 * (re-)populating with the current static Orbit assets:
 *
 *   cd backend && npx ts-node --compiler-options {"module":"commonjs"} scripts/upload-orbit-assets.ts
 *
 * Reads STORAGE_* from backend/.env by default (via dotenv); point it at
 * staging by exporting the staging STORAGE_* values before running.
 */
import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ORBIT_ASSETS_DIR = join(__dirname, '../../apps/web/public/orbit');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
};

async function main() {
  const bucket = requireEnv('STORAGE_BUCKET');
  const client = new S3Client({
    endpoint: requireEnv('STORAGE_ENDPOINT'),
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: requireEnv('STORAGE_ACCESS_KEY'),
      secretAccessKey: requireEnv('STORAGE_SECRET_KEY'),
    },
  });

  const files = (await readdir(ORBIT_ASSETS_DIR)).filter((name) =>
    name.startsWith('orbit_'),
  );

  console.log(
    `Uploading ${files.length} Orbit assets to bucket "${bucket}"...`,
  );

  for (const filename of files) {
    const ext = extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      console.warn(`Skipping ${filename}: unrecognized extension ${ext}`);
      continue;
    }

    const body = await readFile(join(ORBIT_ASSETS_DIR, filename));
    const key = `orbit/${filename}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    console.log(`  uploaded ${key} (${body.byteLength} bytes)`);
  }

  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
