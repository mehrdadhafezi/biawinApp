/**
 * Stage 5.16-E — authenticated, API-only fixture verification for the
 * Stage 5.16-B Home CMS hardening (docs/STAGE-5.16-HOME-BACKEND-HARDENING-
 * PLAN.md / -RESULT.md), closing the BLOCKED items from Stage 5.16-C/D.
 *
 * Deliberately NOT `authenticated-qa-runner.ts`: this file is single-layer
 * (API only), never chains into Browser QA, and is scoped to exactly the
 * Stage 5.16 test matrix. Run ONLY via
 * `deploy/staging/run-stage-5-16-e-verification.sh` (a human on the staging
 * server, or the `stage-5-16-e-home-verification.yml` workflow_dispatch
 * workflow) — the same trust boundary `run-authenticated-qa.sh` uses. Runs
 * inside the real `backend` Docker image (direct Prisma/DB access + the
 * container's own STORAGE_* env), zero new npm dependencies.
 *
 * Secret handling: `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` come from this
 * container's normal environment (Compose `env_file:`), exactly like
 * `authenticated-qa-runner.ts`. Never echoed, never written to a report;
 * anything JWT-shaped and the password are redacted (`redact()`).
 *
 * FIXTURE PLAN (deliberate, disclosed deviations from a literal fixture list):
 *
 *  §1. No Hero Card fixture: `cardKey` is a closed 3-value `@unique` enum
 *      and all 3 rows already exist, so a 4th cannot be created (same
 *      constraint `authenticated-qa-runner.ts` documents). The duplicate-
 *      cardKey test reuses the existing `earn` key and asserts 409 + an
 *      unchanged row count. No existing Hero Card is read-modified.
 *  §2. No Category fixture: every category-dependent test here is a
 *      NEGATIVE test (a guaranteed-nonexistent uuid). This keeps
 *      `categories` (a protected table) off this script's write surface.
 *  §3. Fixture writes are confined to `home_news_articles` and
 *      `media_assets` (+ their storage objects). If a negative test that
 *      SHOULD be rejected is unexpectedly accepted, the created row is
 *      registered and cleaned up too (banner/news).
 *  §4. Soft-deleted-media -> `image: null`: the API cannot create that
 *      state by design (Stage 5.16-B requires an ACTIVE asset on every write
 *      and blocks soft-deleting a referenced one). Precedent for narrow
 *      direct-Prisma fixture work exists in `authenticated-qa-runner.ts`
 *      (temporary RBAC admins). This script performs ONE direct
 *      `homeNewsArticle.update()` on a News row it created, pointing it at a
 *      MediaAsset it created and soft-deleted — and only after both exist.
 *  §5. Cleanup completeness: `DELETE /admin/media/:id` is a SOFT delete (the
 *      row and storage object remain by design), so a QA media asset can
 *      never be fully removed through the API. After the API delete, this
 *      script hard-deletes ONLY the media rows/objects it created itself
 *      (id recorded at upload, fileName carries the QA tag), and only after
 *      confirming with read-only counts that nothing references them (the 7
 *      FK columns + Service gallery ids). Nothing else is ever hard-deleted.
 *
 * bodySlug root cause (Stage 5.16-E first run): the first version built
 * slugs from `QA_TAG` (`stage516e_qa_...`), which contains underscores; the
 * backend's documented slug contract (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) correctly
 * rejected them with 400. That was a verifier defect, not a backend one.
 * Every slug is now produced by `makeQaBodySlug()` and validated before use.
 */
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_ORIGIN = process.env.STAGE516E_API_ORIGIN || 'http://backend:4000';
const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL;
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const REPORT_DIR = process.env.STAGE516E_REPORT_DIR ?? '/tmp/stage-5-16-e';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');

const RUN_SUFFIX = `${Date.now()}-${randomBytes(3).toString('hex')}`;
/** Text-field tag (category/kicker/title/fileName) — required prefix `stage516e_qa_`. Free text, so underscores are fine HERE only. */
const QA_TAG = `stage516e_qa_${RUN_SUFFIX.replace(/-/g, '_')}`;
/** Slug-safe prefix for every bodySlug: lowercase letters, digits, single hyphens only. */
const QA_SLUG_PREFIX = `stage516e-qa-${RUN_SUFFIX}`;

/** Mirrors the backend contract in `home-dto.decorators.ts` (BODY_SLUG_PATTERN, max 100). Kept as a local copy on purpose: the verifier must not import application code. */
const BODY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BODY_SLUG_MAX = 100;

/** The ONE place a bodySlug is ever built. `suffix` must itself be [a-z0-9]+ . */
function makeQaBodySlug(suffix: string): string {
  if (!/^[a-z0-9]+$/.test(suffix)) {
    throw new Error(`makeQaBodySlug: suffix "${suffix}" must be [a-z0-9]+`);
  }
  const slug = `${QA_SLUG_PREFIX}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!BODY_SLUG_PATTERN.test(slug) || slug.length > BODY_SLUG_MAX) {
    throw new Error(
      `makeQaBodySlug: generated slug "${slug}" violates the bodySlug contract`,
    );
  }
  return slug;
}

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
interface Result {
  name: string;
  status: Status;
  detail: string;
}
const results: Result[] = [];

function record(name: string, status: Status, detail = ''): void {
  results.push({ name, status, detail });
  console.log(
    `[stage-5.16-e] ${status.padEnd(8)} ${name}${detail ? ' — ' + redact(detail) : ''}`,
  );
}

function redact(s: string): string {
  let out = s.replace(
    /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    '<redacted-jwt>',
  );
  if (ADMIN_SEED_PASSWORD)
    out = out.split(ADMIN_SEED_PASSWORD).join('<redacted>');
  return out;
}

async function step<T>(
  name: string,
  fn: () => T | Promise<T>,
): Promise<T | undefined> {
  try {
    const value = await fn();
    record(name, 'PASS');
    return value;
  } catch (err) {
    record(name, 'FAIL', err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

/** A required test: runs only when its dependencies hold, otherwise a controlled NOT_RUN naming the reason. */
const REQUIRED_TESTS = new Set<number>();
async function runTest(
  n: number,
  name: string,
  deps: { ok: boolean; reason: string },
  fn: () => Promise<void>,
): Promise<void> {
  REQUIRED_TESTS.add(n);
  const label = `TEST ${n}: ${name}`;
  if (!deps.ok) {
    record(label, 'NOT_RUN', `dependency not satisfied — ${deps.reason}`);
    return;
  }
  await step(label, fn);
}

// ---------------------------------------------------------------------------
// Fixture registry — every created object is registered IMMEDIATELY, with its
// own cleanup, so the final report can list exactly what was created/left.
// ---------------------------------------------------------------------------

type FixtureType = 'news' | 'media' | 'banner';
interface Fixture {
  type: FixtureType;
  id: string;
  tag: string;
  storageKey?: string;
  cleanup: 'PENDING' | 'OK' | 'FAILED';
  cleanupDetail: string;
}
const fixtures: Fixture[] = [];

function registerFixture(type: FixtureType, id: string, tag: string): Fixture {
  const f: Fixture = { type, id, tag, cleanup: 'PENDING', cleanupDetail: '' };
  fixtures.push(f);
  return f;
}

// ---------------------------------------------------------------------------
// HTTP helpers (same envelope-unwrapping contract as authenticated-qa-runner.ts)
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  status: number;
  body: T;
  ok: boolean;
  errorMessage?: string;
}

async function apiCall<T = unknown>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}${path}`, { ...init, headers });
  } catch (err) {
    const cause =
      err instanceof Error && 'cause' in err ? err.cause : undefined;
    const causeDetail =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : typeof cause === 'string'
          ? cause
          : cause !== undefined
            ? JSON.stringify(cause)
            : 'no cause reported';
    throw new Error(
      `network request to ${API_ORIGIN}${path} failed before a response was received — ${causeDetail}`,
    );
  }
  let parsed: unknown;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  let body: unknown = parsed;
  let errorMessage: string | undefined;
  if (parsed && typeof parsed === 'object') {
    const envelope = parsed as {
      success?: unknown;
      data?: unknown;
      error?: { message?: unknown };
    };
    if (envelope.success === true && 'data' in envelope) body = envelope.data;
    else if (envelope.success === false && envelope.error) {
      errorMessage =
        typeof envelope.error.message === 'string'
          ? envelope.error.message
          : undefined;
    }
  }
  return { status: res.status, body: body as T, ok: res.ok, errorMessage };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function detail(res: ApiResponse<unknown>): string {
  return `HTTP ${res.status}${res.errorMessage ? ' — ' + res.errorMessage : ''}`;
}
function assertStatus(
  res: ApiResponse<unknown>,
  expected: number,
  context: string,
): void {
  assert(
    res.status === expected,
    `${context}: expected HTTP ${expected}, got ${detail(res)}`,
  );
}
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

// ---------------------------------------------------------------------------
// A tiny, real, valid PNG (self-contained)
// ---------------------------------------------------------------------------
function qaPng(width = 8, height = 8): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13);
  const type = Buffer.from('IHDR', 'ascii');
  const w = Buffer.alloc(4);
  w.writeUInt32BE(width);
  const h = Buffer.alloc(4);
  h.writeUInt32BE(height);
  const rest = Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]);
  const crc = Buffer.alloc(4);
  return Buffer.concat([signature, length, type, w, h, rest, crc]);
}

// ---------------------------------------------------------------------------
// Checksums — identical methodology to Stage 5.16-B/C/D
// ---------------------------------------------------------------------------

interface TableChecksum {
  table: string;
  count: number;
  md5: string | null;
}

async function checksumOne(label: string, sql: string): Promise<TableChecksum> {
  const rows =
    await prisma.$queryRawUnsafe<{ count: number; md5: string | null }[]>(sql);
  const row = rows[0];
  return {
    table: label,
    count: Number(row?.count ?? 0),
    md5: row?.md5 ?? null,
  };
}

const IDREF = (t: string) =>
  `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' order by id), '')) as md5 from ${t}`;

async function computeProtectedChecksums(): Promise<TableChecksum[]> {
  return Promise.all([
    checksumOne('card_products', IDREF('card_products')),
    checksumOne('category_cards', IDREF('category_cards')),
    checksumOne('categories', IDREF('categories')),
    checksumOne('services', IDREF('services')),
    checksumOne(
      'services.gallery',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("galleryMediaAssetIds"::text,'[]'), ',' order by id), '')) as md5 from services`,
    ),
  ]);
}

function writeFile(filename: string, content: string): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${filename}`, content, 'utf8');
}

function writeChecksumFile(filename: string, rows: TableChecksum[]): void {
  writeFile(
    filename,
    rows.map((r) => `${r.table} | ${r.count} | ${r.md5}`).join('\n') + '\n',
  );
}

function compareChecksums(before: TableChecksum[], after: TableChecksum[]) {
  return before.map((b) => {
    const a = after.find((x) => x.table === b.table);
    const match = !!a && a.md5 === b.md5 && a.count === b.count;
    return {
      table: b.table,
      before: `${b.count}|${b.md5}`,
      after: a ? `${a.count}|${a.md5}` : 'MISSING',
      match,
    };
  });
}

// ---------------------------------------------------------------------------
// Public Home counts
// ---------------------------------------------------------------------------

interface HomeCounts {
  hero: number;
  banners: number;
  mosaic: number;
  news: number;
}

async function fetchHomeCounts(context: string): Promise<HomeCounts> {
  const [hero, banners, mosaic, news] = await Promise.all([
    apiCall<unknown[]>('/api/v1/home/hero-cards'),
    apiCall<unknown[]>('/api/v1/home/service-banners'),
    apiCall<unknown[]>('/api/v1/home/service-mosaic-tiles'),
    apiCall<unknown[]>('/api/v1/home/news-articles'),
  ]);
  for (const r of [hero, banners, mosaic, news]) {
    assert(
      r.ok && r.status === 200,
      `${context}: public Home GET unhealthy: ${detail(r)}`,
    );
  }
  return {
    hero: hero.body.length,
    banners: banners.body.length,
    mosaic: mosaic.body.length,
    news: news.body.length,
  };
}

// ---------------------------------------------------------------------------
// Admin session
// ---------------------------------------------------------------------------

interface AdminSession {
  accessToken: string;
  role: string;
  email: string;
}

async function adminLogin(
  email: string,
  password: string,
): Promise<AdminSession> {
  const res = await apiCall<{ accessToken: string }>(
    '/api/v1/admin/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  assert(res.ok, `admin login failed: ${detail(res)}`);
  assert(
    typeof res.body.accessToken === 'string' && res.body.accessToken.length > 0,
    'admin login returned no usable accessToken',
  );
  const me = await apiCall<{ role: string; email: string }>(
    '/api/v1/admin/auth/me',
    {
      token: res.body.accessToken,
    },
  );
  assert(me.ok, `post-login /me failed: ${detail(me)}`);
  return {
    accessToken: res.body.accessToken,
    role: me.body.role,
    email: me.body.email,
  };
}

// ---------------------------------------------------------------------------
// Fixture creation helpers
// ---------------------------------------------------------------------------

/**
 * The ONE place a News POST body is built. Asserts the bodySlug is exactly
 * the `makeQaBodySlug` result and logs it (the slug is not a secret) so a
 * backend 400 can be diagnosed from the report alone.
 */
function buildNewsPayload(
  slugSuffix: string,
  extra: Record<string, unknown> = {},
): { payload: Record<string, unknown>; slug: string } {
  const slug = makeQaBodySlug(slugSuffix);
  const payload = {
    category: QA_TAG,
    kicker: QA_TAG,
    title: QA_TAG,
    lead: QA_TAG,
    bodySlug: slug,
    active: false,
    ...extra,
  };
  assert(
    payload.bodySlug === slug,
    'payload bodySlug must be exactly the makeQaBodySlug result',
  );
  assert(
    typeof payload.bodySlug === 'string' &&
      BODY_SLUG_PATTERN.test(payload.bodySlug),
    `payload bodySlug "${String(payload.bodySlug)}" is not slug-valid`,
  );
  console.log(`[stage-5.16-e] POST /admin/home/news-articles bodySlug=${slug}`);
  return { payload, slug };
}

async function postNews(
  admin: AdminSession,
  slugSuffix: string,
  extra: Record<string, unknown> = {},
): Promise<{ res: ApiResponse<{ id: string }>; slug: string }> {
  const { payload, slug } = buildNewsPayload(slugSuffix, extra);
  const res = await apiCall<{ id: string }>(
    '/api/v1/admin/home/news-articles',
    {
      method: 'POST',
      token: admin.accessToken,
      body: JSON.stringify(payload),
    },
  );
  // A negative test that was unexpectedly ACCEPTED must still be cleaned up.
  if (res.ok && isUuid(res.body?.id)) registerNewsFixture(res.body.id, slug);
  return { res, slug };
}

const registeredNews = new Set<string>();
function registerNewsFixture(id: string, slug: string): void {
  if (registeredNews.has(id)) return;
  registeredNews.add(id);
  registerFixture('news', id, `bodySlug=${slug}`);
}

async function uploadMedia(
  admin: AdminSession,
  suffix: string,
): Promise<string> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(qaPng())], { type: 'image/png' }),
    `${QA_TAG}-${suffix}.png`,
  );
  form.append('altText', `${QA_TAG} media ${suffix}`);
  const res = await apiCall<{ id: string }>('/api/v1/admin/media/upload', {
    method: 'POST',
    token: admin.accessToken,
    body: form,
  });
  assert(res.ok, `media ${suffix} upload failed: ${detail(res)}`);
  assert(isUuid(res.body.id), `media ${suffix} upload returned no uuid id`);
  // Register IMMEDIATELY (before any further call that could throw).
  const f = registerFixture(
    'media',
    res.body.id,
    `fileName=${QA_TAG}-${suffix}.png`,
  );
  const row = await prisma.mediaAsset.findUnique({
    where: { id: res.body.id },
  });
  f.storageKey = row?.key;
  return res.body.id;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function storageClient(): { client: S3Client; bucket: string } | undefined {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
    return undefined;
  return {
    bucket,
    client: new S3Client({
      endpoint,
      region: process.env.STORAGE_REGION || 'us-east-1',
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function countReferences(mediaId: string): Promise<number> {
  const counts = await Promise.all([
    prisma.homeServiceBanner.count({ where: { mediaAssetId: mediaId } }),
    prisma.homeServiceMosaicTile.count({ where: { mediaAssetId: mediaId } }),
    prisma.homeNewsArticle.count({ where: { mediaAssetId: mediaId } }),
    prisma.category.count({ where: { mediaAssetId: mediaId } }),
    prisma.categoryCard.count({ where: { mediaAssetId: mediaId } }),
    prisma.service.count({ where: { mediaAssetId: mediaId } }),
    prisma.service.count({
      where: { galleryMediaAssetIds: { array_contains: mediaId } },
    }),
    prisma.cardProduct.count({ where: { mediaAssetId: mediaId } }),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

async function cleanupOne(
  admin: AdminSession | undefined,
  f: Fixture,
): Promise<void> {
  try {
    if (f.type === 'news' || f.type === 'banner') {
      const path =
        f.type === 'news'
          ? `/api/v1/admin/home/news-articles/${f.id}`
          : `/api/v1/admin/home/service-banners/${f.id}`;
      assert(!!admin, 'no admin session available for cleanup');
      const res = await apiCall(path, {
        method: 'DELETE',
        token: admin!.accessToken,
      });
      assert(res.ok || res.status === 404, `API delete failed: ${detail(res)}`);
      f.cleanup = 'OK';
      f.cleanupDetail = `API DELETE -> HTTP ${res.status}`;
      return;
    }
    // media: (1) API soft delete (best effort — may already be soft-deleted),
    // (2) verifier-owned hard delete of THIS fixture only, after proving no
    // reference exists anywhere.
    if (admin) {
      const res = await apiCall(`/api/v1/admin/media/${f.id}`, {
        method: 'DELETE',
        token: admin.accessToken,
      });
      f.cleanupDetail = `API DELETE -> HTTP ${res.status}; `;
    }
    const row = await prisma.mediaAsset.findUnique({ where: { id: f.id } });
    if (row) {
      assert(
        row.fileName.includes(QA_TAG),
        `refusing to hard-delete media ${f.id}: fileName does not carry this run's QA tag`,
      );
      const refs = await countReferences(f.id);
      assert(
        refs === 0,
        `refusing to hard-delete media ${f.id}: still referenced (${refs})`,
      );
      await prisma.mediaAsset.delete({ where: { id: f.id } });
      f.cleanupDetail += 'row hard-deleted; ';
    } else {
      f.cleanupDetail += 'row already absent; ';
    }
    const key = f.storageKey ?? row?.key;
    const store = storageClient();
    if (key && store) {
      await store.client.send(
        new DeleteObjectCommand({ Bucket: store.bucket, Key: key }),
      );
      f.cleanupDetail += 'storage object deleted';
    } else if (key) {
      throw new Error(
        'storage env (STORAGE_*) not available — storage object could not be deleted',
      );
    }
    f.cleanup = 'OK';
  } catch (err) {
    f.cleanup = 'FAILED';
    f.cleanupDetail += err instanceof Error ? err.message : String(err);
  }
}

async function runCleanup(admin: AdminSession | undefined): Promise<void> {
  console.log(
    `[stage-5.16-e] running cleanup for ${fixtures.length} registered fixture(s)...`,
  );
  // Reverse creation order: dependents (News rows) before the media they reference.
  for (const f of [...fixtures].reverse()) {
    await cleanupOne(admin, f);
    record(
      `CLEANUP ${f.type} ${f.id}`,
      f.cleanup === 'OK' ? 'PASS' : 'FAIL',
      f.cleanupDetail,
    );
  }
}

interface RemainingFixture {
  type: string;
  id: string;
  tag: string;
  cleanup: string;
}

/** Existence by ID for every fixture this run created, PLUS a tag/slug sweep, PLUS storage objects. */
async function findRemainingFixtures(): Promise<RemainingFixture[]> {
  const remaining = new Map<string, RemainingFixture>();
  const add = (type: string, id: string, tag: string) => {
    const f = fixtures.find((x) => x.id === id);
    remaining.set(`${type}:${id}`, {
      type,
      id,
      tag,
      cleanup: f
        ? `${f.cleanup}${f.cleanupDetail ? ' (' + f.cleanupDetail + ')' : ''}`
        : 'not registered (found by tag sweep)',
    });
  };
  for (const f of fixtures) {
    if (f.type === 'news') {
      if (await prisma.homeNewsArticle.findUnique({ where: { id: f.id } }))
        add('home_news_articles', f.id, f.tag);
    } else if (f.type === 'banner') {
      if (await prisma.homeServiceBanner.findUnique({ where: { id: f.id } }))
        add('home_service_banners', f.id, f.tag);
    } else {
      if (await prisma.mediaAsset.findUnique({ where: { id: f.id } }))
        add('media_assets', f.id, f.tag);
      const store = storageClient();
      if (store && f.storageKey) {
        try {
          await store.client.send(
            new HeadObjectCommand({ Bucket: store.bucket, Key: f.storageKey }),
          );
          add('storage_object', f.storageKey, f.tag);
        } catch {
          /* NotFound == cleaned */
        }
      }
    }
  }
  // Tag sweep — catches anything created but never registered.
  const [news, banners, media] = await Promise.all([
    prisma.homeNewsArticle.findMany({
      where: {
        OR: [
          { category: QA_TAG },
          { kicker: QA_TAG },
          { title: QA_TAG },
          { bodySlug: { startsWith: QA_SLUG_PREFIX } },
        ],
      },
      select: { id: true, bodySlug: true },
    }),
    prisma.homeServiceBanner.findMany({
      where: { kicker: QA_TAG },
      select: { id: true },
    }),
    prisma.mediaAsset.findMany({
      where: { fileName: { contains: QA_TAG } },
      select: { id: true, fileName: true },
    }),
  ]);
  for (const n of news)
    add('home_news_articles', n.id, `bodySlug=${n.bodySlug ?? 'null'}`);
  for (const b of banners)
    add('home_service_banners', b.id, `kicker=${QA_TAG}`);
  for (const m of media) add('media_assets', m.id, `fileName=${m.fileName}`);
  return [...remaining.values()];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const NONEXISTENT_CATEGORY = '00000000-0000-4000-8000-000000000000';
const NONEXISTENT_MEDIA = '00000000-0000-4000-8000-000000000001';
/** Syntactically a valid UUID (v4 nibble, RFC variant) so it passes DTO validation and reaches the service layer. */
const NONEXISTENT_REORDER_ID = '00000000-0000-4000-8000-000000000002';

let remainingFixtures: RemainingFixture[] = [];

async function main(): Promise<void> {
  console.log(`[stage-5.16-e] run tag: ${QA_TAG}`);
  console.log(`[stage-5.16-e] slug prefix: ${QA_SLUG_PREFIX}`);
  console.log(`[stage-5.16-e] API origin: ${API_ORIGIN}`);

  // Aborts by THROWING; only the single top-level chain below ever calls finish().
  if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD) {
    record(
      'Admin credentials present',
      'BLOCKED',
      'ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not present in this container’s environment',
    );
    throw new Error('Cannot run without ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD');
  }

  let admin: AdminSession | undefined;
  let beforeChecksums: TableChecksum[] | undefined;
  let beforeCounts: HomeCounts | undefined;
  try {
    admin = await step('Admin login (existing ADMIN_SEED_* mechanism)', () =>
      adminLogin(ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD),
    );
    if (!admin)
      throw new Error(
        'admin login failed — aborting before any fixture is created',
      );
    assert(
      admin.role === 'SUPER_ADMIN',
      `seeded admin has role ${admin.role}, expected SUPER_ADMIN`,
    );
    const adm = admin;

    beforeChecksums = await step(
      'BEFORE: compute protected-table checksums',
      computeProtectedChecksums,
    );
    if (!beforeChecksums) {
      throw new Error(
        'could not compute the BEFORE checksum baseline — aborting before any fixture is created',
      );
    }
    writeChecksumFile('stage-5.16-e-before.txt', beforeChecksums);
    beforeCounts = await step('BEFORE: public Home GET counts', () =>
      fetchHomeCounts('BEFORE'),
    );

    // ===== TEST 1 — malformed UUID (authenticated) ========================
    await runTest(
      1,
      'malformed UUID on GET /admin/home/hero-cards/:id -> 400',
      { ok: true, reason: '' },
      async () => {
        const res = await apiCall('/api/v1/admin/home/hero-cards/not-a-uuid', {
          token: adm.accessToken,
        });
        assertStatus(res, 400, 'malformed uuid');
      },
    );

    // ===== TEST 2 — duplicate cardKey (no Hero fixture; see header §1) ====
    await runTest(
      2,
      'duplicate cardKey (reusing existing "earn") -> 409, nothing written',
      { ok: true, reason: '' },
      async () => {
        const list = await apiCall<{ total: number }>(
          '/api/v1/admin/home/hero-cards?limit=100',
          { token: adm.accessToken },
        );
        assert(list.ok, `list hero-cards failed: ${detail(list)}`);
        const res = await apiCall('/api/v1/admin/home/hero-cards', {
          method: 'POST',
          token: adm.accessToken,
          body: JSON.stringify({
            cardKey: 'earn',
            label: QA_TAG,
            title: QA_TAG,
            subtitle: QA_TAG,
            displayNumber: '0000',
            ownerLabel: QA_TAG,
          }),
        });
        assertStatus(res, 409, 'duplicate cardKey');
        const after = await apiCall<{ total: number }>(
          '/api/v1/admin/home/hero-cards?limit=100',
          { token: adm.accessToken },
        );
        assert(
          after.ok && after.body.total === list.body.total,
          `hero-card count must be unchanged (${list.body.total}), got ${after.ok ? after.body.total : detail(after)}`,
        );
      },
    );

    // ===== Fixtures: Media A + News #1 ====================================
    const mediaAId = await step('Fixture: upload QA media A (active)', () =>
      uploadMedia(adm, 'a'),
    );

    let news1Id: string | undefined;
    const news1Slug = makeQaBodySlug('news1');
    await step(
      'Fixture: create QA News #1 (inactive, references media A)',
      async () => {
        const { res, slug } = await postNews(adm, 'news1', {
          sortOrder: 99999,
          ...(mediaAId ? { mediaAssetId: mediaAId } : {}),
        });
        assert(
          res.ok,
          `create News #1 failed (bodySlug=${slug}): ${detail(res)}`,
        );
        assert(isUuid(res.body.id), 'create News #1 returned no uuid id');
        news1Id = res.body.id;
      },
    );

    // ===== TEST 3 — duplicate bodySlug =====================================
    await runTest(
      3,
      'duplicate bodySlug (reusing News #1’s slug) -> 409, nothing written',
      {
        ok: isUuid(news1Id),
        reason: 'fixture News #1 was not created',
      },
      async () => {
        const dup = buildNewsPayload('news1'); // same helper input -> same slug as News #1
        assert(
          dup.slug === news1Slug,
          'duplicate-slug payload must reuse News #1’s exact slug',
        );
        const res = await apiCall<{ id: string }>(
          '/api/v1/admin/home/news-articles',
          {
            method: 'POST',
            token: adm.accessToken,
            body: JSON.stringify(dup.payload),
          },
        );
        if (res.ok && isUuid(res.body?.id))
          registerNewsFixture(res.body.id, dup.slug);
        assertStatus(res, 409, 'duplicate bodySlug');
      },
    );

    // ===== TEST 4 — unknown category ======================================
    await runTest(
      4,
      'unknown categoryId on a Service Banner create -> 422, nothing written',
      { ok: true, reason: '' },
      async () => {
        const res = await apiCall<{ id: string }>(
          '/api/v1/admin/home/service-banners',
          {
            method: 'POST',
            token: adm.accessToken,
            body: JSON.stringify({
              categoryId: NONEXISTENT_CATEGORY,
              kicker: QA_TAG,
              active: false,
            }),
          },
        );
        if (res.ok && isUuid(res.body?.id))
          registerFixture('banner', res.body.id, `kicker=${QA_TAG}`);
        assertStatus(res, 422, 'unknown category');
      },
    );

    // ===== TEST 5 — unknown media (isolated: its own valid slug) ==========
    await runTest(
      5,
      'unknown mediaAssetId on a News create -> 422, nothing written',
      { ok: true, reason: '' },
      async () => {
        const { res, slug } = await postNews(adm, 'unknownmedia', {
          mediaAssetId: NONEXISTENT_MEDIA,
        });
        assertStatus(res, 422, `unknown media (bodySlug=${slug})`);
        const created = await prisma.homeNewsArticle.count({
          where: { bodySlug: slug },
        });
        assert(
          created === 0,
          `a News row with bodySlug=${slug} exists despite the 422`,
        );
      },
    );

    // ===== Fixture: News #2 ===============================================
    let news2Id: string | undefined;
    await step(
      'Fixture: create QA News #2 (inactive, for reorder tests)',
      async () => {
        const { res, slug } = await postNews(adm, 'news2', {
          sortOrder: 99998,
        });
        assert(
          res.ok,
          `create News #2 failed (bodySlug=${slug}): ${detail(res)}`,
        );
        assert(isUuid(res.body.id), 'create News #2 returned no uuid id');
        news2Id = res.body.id;
      },
    );

    // ===== TESTS 6-10 — reorder validation ================================
    const reorder = (items: unknown[]) =>
      apiCall('/api/v1/admin/home/news-articles/reorder', {
        method: 'PATCH',
        token: adm.accessToken,
        body: JSON.stringify({ items }),
      });

    await runTest(
      6,
      'empty reorder payload -> 400',
      { ok: true, reason: '' },
      async () => {
        assertStatus(await reorder([]), 400, 'empty reorder');
      },
    );
    await runTest(
      7,
      'malformed UUID in reorder payload -> 400',
      { ok: true, reason: '' },
      async () => {
        assertStatus(
          await reorder([{ id: 'not-a-uuid', sortOrder: 1 }]),
          400,
          'malformed reorder uuid',
        );
      },
    );
    await runTest(
      8,
      'duplicate reorder ID -> 400',
      { ok: isUuid(news1Id), reason: 'fixture News #1 was not created' },
      async () => {
        assertStatus(
          await reorder([
            { id: news1Id, sortOrder: 1 },
            { id: news1Id, sortOrder: 2 },
          ]),
          400,
          'duplicate reorder id',
        );
      },
    );
    await runTest(
      9,
      'duplicate reorder position -> 400',
      {
        ok: isUuid(news1Id) && isUuid(news2Id),
        reason: 'fixture News #1 and/or #2 was not created',
      },
      async () => {
        assertStatus(
          await reorder([
            { id: news1Id, sortOrder: 5 },
            { id: news2Id, sortOrder: 5 },
          ]),
          400,
          'duplicate reorder position',
        );
      },
    );
    await runTest(
      10,
      'unknown (but valid-UUID) reorder ID -> 422, nothing written',
      { ok: true, reason: '' },
      async () => {
        assert(
          isUuid(NONEXISTENT_REORDER_ID),
          'NONEXISTENT_REORDER_ID must be a syntactically valid UUID',
        );
        const items: unknown[] = [];
        if (isUuid(news1Id)) items.push({ id: news1Id, sortOrder: 5 });
        items.push({ id: NONEXISTENT_REORDER_ID, sortOrder: 6 });
        assertStatus(await reorder(items), 422, 'unknown reorder id');
        if (isUuid(news1Id)) {
          const check = await apiCall<{ sortOrder: number }>(
            `/api/v1/admin/home/news-articles/${news1Id}`,
            { token: adm.accessToken },
          );
          assert(
            check.ok && check.body.sortOrder === 99999,
            `News #1 sortOrder must be unchanged (99999) after a rejected reorder, got ${check.ok ? check.body.sortOrder : detail(check)}`,
          );
        }
      },
    );

    // ===== TEST 11 — valid partial reorder, then restore ===================
    await runTest(
      11,
      'valid partial reorder (News #1 <-> News #2), then restore original order',
      {
        ok: isUuid(news1Id) && isUuid(news2Id),
        reason: 'fixture News #1 and/or #2 was not created',
      },
      async () => {
        const get = (id: string) =>
          apiCall<{ sortOrder: number }>(
            `/api/v1/admin/home/news-articles/${id}`,
            { token: adm.accessToken },
          );
        const swap = await reorder([
          { id: news1Id, sortOrder: 99998 },
          { id: news2Id, sortOrder: 99999 },
        ]);
        assertStatus(swap, 200, 'valid partial reorder');
        const m1 = await get(news1Id!);
        const m2 = await get(news2Id!);
        assert(
          m1.ok && m1.body.sortOrder === 99998,
          'News #1 sortOrder did not update to 99998',
        );
        assert(
          m2.ok && m2.body.sortOrder === 99999,
          'News #2 sortOrder did not update to 99999',
        );
        const restore = await reorder([
          { id: news1Id, sortOrder: 99999 },
          { id: news2Id, sortOrder: 99998 },
        ]);
        assertStatus(restore, 200, 'restore original order');
        const f1 = await get(news1Id!);
        const f2 = await get(news2Id!);
        assert(
          f1.ok && f1.body.sortOrder === 99999,
          'restore of News #1 sortOrder failed',
        );
        assert(
          f2.ok && f2.body.sortOrder === 99998,
          'restore of News #2 sortOrder failed',
        );
      },
    );

    // ===== TEST 12 — soft-deleted media -> image: null =====================
    // Order matters (spec): (1) create Media C, (2) soft-delete it via the API
    // while unreferenced, (3) create News #3, (4) confirm it exists + capture
    // its id, (5) ONLY THEN direct Prisma, (6) public GET, (7) assertions.
    const mediaCId = await step(
      'Fixture: upload QA media C (for the soft-delete test)',
      () => uploadMedia(adm, 'c'),
    );
    let mediaCSoftDeleted = false;
    if (isUuid(mediaCId)) {
      await step(
        'Fixture: soft-delete QA media C while unreferenced -> 200',
        async () => {
          const res = await apiCall(`/api/v1/admin/media/${mediaCId}`, {
            method: 'DELETE',
            token: adm.accessToken,
          });
          assertStatus(res, 200, 'soft-delete unreferenced media');
          mediaCSoftDeleted = true;
        },
      );
    }

    let news3Id: string | undefined;
    let news3Confirmed = false;
    await step(
      'Fixture: create QA News #3 (ACTIVE — must appear on the public endpoint for this one test)',
      async () => {
        const { res, slug } = await postNews(adm, 'news3', {
          sortOrder: 99997,
          active: true,
        });
        assert(
          res.ok,
          `create News #3 failed (bodySlug=${slug}): ${detail(res)}`,
        );
        assert(isUuid(res.body.id), 'create News #3 returned no uuid id');
        news3Id = res.body.id;
        const check = await apiCall<{ id: string }>(
          `/api/v1/admin/home/news-articles/${news3Id}`,
          { token: adm.accessToken },
        );
        assert(
          check.ok && check.body.id === news3Id,
          `News #3 was not readable after creation: ${detail(check)}`,
        );
        news3Confirmed = true;
      },
    );

    const t12Deps =
      isUuid(mediaCId) &&
      mediaCSoftDeleted &&
      isUuid(news3Id) &&
      news3Confirmed;
    await runTest(
      12,
      'soft-deleted media: public GET shows the QA row with image: null (HTTP 200, row present)',
      {
        ok: t12Deps,
        reason: `media C created=${isUuid(mediaCId)} soft-deleted=${mediaCSoftDeleted}; News #3 created+confirmed=${isUuid(news3Id) && news3Confirmed}`,
      },
      async () => {
        // DELIBERATE direct-Prisma step (header §4): fixture row -> fixture soft-deleted asset.
        await prisma.homeNewsArticle.update({
          where: { id: news3Id! },
          data: { mediaAssetId: mediaCId! },
        });
        const rb = await prisma.homeNewsArticle.findUnique({
          where: { id: news3Id! },
        });
        assert(
          rb?.mediaAssetId === mediaCId,
          'read-back: News #3 does not reference media C after the fixture update',
        );
        const res = await apiCall<{ id: string; image: string | null }[]>(
          '/api/v1/home/news-articles',
        );
        assertStatus(
          res,
          200,
          'public news-articles after soft-deleted-media fixture',
        );
        const row = res.body.find((r) => r.id === news3Id);
        assert(
          !!row,
          'QA News #3 was not present in the public response at all',
        );
        assert(
          row!.image === null,
          `expected image: null for a soft-deleted MediaAsset reference, got ${JSON.stringify(row!.image)}`,
        );
      },
    );

    // ===== TEST 13 — media delete protection ===============================
    let refConfirmed = false;
    if (isUuid(mediaAId) && isUuid(news1Id)) {
      const g = await apiCall<{ mediaAssetId: string | null }>(
        `/api/v1/admin/home/news-articles/${news1Id}`,
        { token: adm.accessToken },
      );
      refConfirmed = g.ok && g.body.mediaAssetId === mediaAId;
    }
    await runTest(
      13,
      'delete QA media A while referenced by News #1 -> 409, media still exists, reference unchanged',
      {
        ok: isUuid(mediaAId) && isUuid(news1Id) && refConfirmed,
        reason: `media A created=${isUuid(mediaAId)}; News #1 created=${isUuid(news1Id)}; News #1 confirmed to reference media A=${refConfirmed}`,
      },
      async () => {
        const res = await apiCall(`/api/v1/admin/media/${mediaAId}`, {
          method: 'DELETE',
          token: adm.accessToken,
        });
        assertStatus(res, 409, 'referenced media delete');
        const media = await apiCall<{ id: string }>(
          `/api/v1/admin/media/${mediaAId}`,
          { token: adm.accessToken },
        );
        assert(
          media.ok && media.body.id === mediaAId,
          `media A must still exist after the rejected delete: ${detail(media)}`,
        );
        const row = await apiCall<{ mediaAssetId: string | null }>(
          `/api/v1/admin/home/news-articles/${news1Id}`,
          { token: adm.accessToken },
        );
        assert(
          row.ok && row.body.mediaAssetId === mediaAId,
          'News #1 mediaAssetId must be unchanged after the rejected delete',
        );
      },
    );

    await step(
      'Public Home GETs remain healthy with fixtures still present',
      () => fetchHomeCounts('pre-cleanup'),
    );
  } finally {
    // Cleanup runs regardless; a cleanup failure never prevents the AFTER evidence below.
    await runCleanup(admin).catch((err: unknown) =>
      record(
        'CLEANUP (unexpected error)',
        'FAIL',
        err instanceof Error ? err.message : String(err),
      ),
    );

    try {
      remainingFixtures = await findRemainingFixtures();
      writeFile(
        'stage-5.16-e-remaining-fixtures.json',
        JSON.stringify(remainingFixtures, null, 2),
      );
      record(
        'Remaining QA fixture count = 0 (by id for every created fixture, storage objects, and tag sweep)',
        remainingFixtures.length === 0 ? 'PASS' : 'FAIL',
        remainingFixtures.length === 0
          ? `created ${fixtures.length} fixture(s), 0 remain`
          : `${remainingFixtures.length} remain: ${JSON.stringify(remainingFixtures)}`,
      );
    } catch (err) {
      record(
        'Remaining QA fixture count = 0',
        'FAIL',
        `remaining-fixture query itself failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      remainingFixtures = [
        { type: 'unknown', id: 'query-failed', tag: '', cleanup: 'UNKNOWN' },
      ];
    }

    if (beforeChecksums) {
      const afterChecksums = await step(
        'AFTER: compute protected-table checksums',
        computeProtectedChecksums,
      );
      if (afterChecksums) {
        writeChecksumFile('stage-5.16-e-after.txt', afterChecksums);
        for (const row of compareChecksums(beforeChecksums, afterChecksums)) {
          record(
            `Image integrity: ${row.table} BEFORE == AFTER`,
            row.match ? 'PASS' : 'FAIL',
            row.match ? '' : `before=${row.before} after=${row.after}`,
          );
        }
      } else {
        record(
          'Image integrity: BEFORE == AFTER (all protected tables)',
          'FAIL',
          'could not compute the AFTER checksums — treated as a mismatch, not a pass',
        );
      }
    }

    if (beforeCounts) {
      const afterCounts = await step('AFTER: public Home GET counts', () =>
        fetchHomeCounts('AFTER'),
      );
      if (afterCounts) {
        const stable =
          afterCounts.hero === beforeCounts.hero &&
          afterCounts.banners === beforeCounts.banners &&
          afterCounts.mosaic === beforeCounts.mosaic &&
          afterCounts.news === beforeCounts.news;
        record(
          'Public Home GET counts returned exactly to the pre-fixture baseline',
          stable ? 'PASS' : 'FAIL',
          stable
            ? ''
            : `before=${JSON.stringify(beforeCounts)} after=${JSON.stringify(afterCounts)}`,
        );
      }
    }
  }
}

async function finish(fatal: Error | null): Promise<void> {
  await prisma.$disconnect().catch(() => {});

  // Final gate: all 13 required tests must have run AND passed.
  const missing: number[] = [];
  for (let n = 1; n <= 13; n++) {
    const r = results.find((x) => x.name.startsWith(`TEST ${n}:`));
    if (!r || r.status !== 'PASS') missing.push(n);
  }
  const testGate = missing.length === 0;
  if (!fatal)
    record(
      'Gate: all 13 required tests PASS',
      testGate ? 'PASS' : 'FAIL',
      testGate ? '' : `not passing: TEST ${missing.join(', ')}`,
    );

  const count = (s: Status) => results.filter((r) => r.status === s).length;
  const passCount = count('PASS');
  const failCount = count('FAIL');
  const blockedCount = count('BLOCKED');
  const notRunCount = count('NOT_RUN');

  const humanPath = `${REPORT_DIR}/stage-5-16-e-report-${RUN_ID}.txt`;
  const jsonPath = `${REPORT_DIR}/stage-5-16-e-report-${RUN_ID}.json`;

  const lines: string[] = [];
  lines.push(
    `Stage 5.16-E authenticated API fixture verification — ${new Date().toISOString()}`,
  );
  lines.push(`Run tag: ${QA_TAG}`);
  lines.push(`Slug prefix: ${QA_SLUG_PREFIX}`);
  lines.push(`API origin: ${API_ORIGIN}`);
  lines.push('');
  for (const r of results)
    lines.push(
      `${r.status.padEnd(8)} ${r.name}${r.detail ? '  — ' + redact(r.detail) : ''}`,
    );
  lines.push('');
  lines.push('Fixtures created by this run (type | id | tag | cleanup):');
  if (fixtures.length === 0) lines.push('  (none)');
  for (const f of fixtures)
    lines.push(
      `  ${f.type} | ${f.id} | ${f.tag} | ${f.cleanup}${f.cleanupDetail ? ' — ' + f.cleanupDetail : ''}`,
    );
  lines.push('');
  lines.push(`Fixtures REMAINING after cleanup: ${remainingFixtures.length}`);
  for (const r of remainingFixtures)
    lines.push(`  ${r.type} | ${r.id} | ${r.tag} | ${r.cleanup}`);
  lines.push('');
  lines.push(
    `Totals: ${passCount} PASS, ${failCount} FAIL, ${blockedCount} BLOCKED, ${notRunCount} NOT_RUN`,
  );
  if (fatal) lines.push(`Fatal error: ${redact(fatal.message)}`);
  const humanReport = lines.join('\n');

  writeFile(`stage-5-16-e-report-${RUN_ID}.txt`, humanReport);
  writeFile(
    `stage-5-16-e-report-${RUN_ID}.json`,
    JSON.stringify(
      {
        runTag: QA_TAG,
        slugPrefix: QA_SLUG_PREFIX,
        timestamp: new Date().toISOString(),
        results,
        fixtures,
        remainingFixtures,
        fatal: fatal?.message ?? null,
      },
      null,
      2,
    ),
  );

  console.log('');
  console.log(humanReport);
  console.log('');
  console.log(`[stage-5.16-e] report written to: ${humanPath}`);
  console.log(`[stage-5.16-e] machine-readable report: ${jsonPath}`);

  // Exit 0 ONLY if nothing failed, nothing was blocked/skipped, nothing remains, and no fatal error.
  const failed =
    failCount > 0 ||
    blockedCount > 0 ||
    notRunCount > 0 ||
    remainingFixtures.length > 0 ||
    !testGate ||
    !!fatal;
  process.exitCode = failed ? 1 : 0;
}

main()
  .then(() => finish(null))
  .catch((err: unknown) =>
    finish(err instanceof Error ? err : new Error(String(err))),
  );
