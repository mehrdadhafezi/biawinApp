/**
 * Stage 5.17-D — fixture-control script for the Home Admin Browser QA
 * (docs/STAGE-5.17-C-HOME-ADMIN-BROWSER-QA-PLAN.md, Appendix A).
 *
 *   node dist/scripts/staging-qa/stage-5-17-c/control.js setup
 *   node dist/scripts/staging-qa/stage-5-17-c/control.js teardown
 *   node dist/scripts/staging-qa/stage-5-17-c/control.js verify
 *
 * Runs ONLY inside the real `backend` Docker image via
 * `deploy/staging/run-stage-5-17-c-browser-qa.sh` (Prisma + the container's
 * own STORAGE_* env, exactly like `run-authenticated-qa.sh` and the Stage
 * 5.16-E verifier). It never opens a browser and is NOT
 * `authenticated-qa-runner.ts`.
 *
 * State lives in STAGE517C_RUN_DIR; the fixture registry is persisted after
 * EVERY registration, so `teardown` (a separate process, run from a shell
 * trap) can clean up even if `setup` or the browser verifier crashed.
 *
 * Secrets: ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD come from the container
 * environment (Compose `env_file`), are never written to any file, and
 * everything written passes through `redact()`. Temporary-role passwords
 * exist only in `roles.json` (0600, deleted at teardown).
 */
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { hashPassword } from '../../../src/modules/admin-auth/password-hash.util';
import {
  FixtureRegistry,
  QA_TESTS,
  assertOwnedByRun,
  compareChecksums,
  compareHomeBaseline,
  finalVerdict,
  isUuid,
  makeQaBodySlug,
  makeQaFileName,
  makeQaRun,
  makeRunId,
  publicCountsEqual,
  type Fixture,
  type FixtureType,
  type HomeRowSnapshot,
  type PublicCounts,
  type QaRun,
  type TableChecksum,
} from './qa-contract';
import {
  RUN_FILES,
  assertValidBodySlug,
  countFirewallViolations,
  formatAuditResidue,
  type AuditResidue,
  envFlag,
  heroReport,
  mergeOutcomes,
  redact,
  tally,
  templatePath,
  type BrowserOutcome,
  type FirewallEvent,
  type Manifest,
  type ManifestFixture,
} from './qa-orchestration';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RUN_DIR = process.env.STAGE517C_RUN_DIR ?? '/tmp/stage-5-17-c';
const API_ORIGIN = process.env.STAGE517C_API_ORIGIN || 'http://backend:4000';
const ADMIN_ORIGIN =
  process.env.STAGE517C_ADMIN_ORIGIN || 'https://admin-staging.biawin.ir';
const BROWSER_API_ORIGIN =
  process.env.STAGE517C_PUBLIC_API_ORIGIN || 'https://api-staging.biawin.ir';
const COMMIT_SHA = process.env.STAGE517C_COMMIT_SHA || 'unknown';
const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL;
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const ALLOW_REORDER_TOUCH = envFlag(
  process.env.STAGE517C_ALLOW_REORDER_METADATA_TOUCH,
);
const PROVISION_ROLES = envFlag(process.env.STAGE517C_PROVISION_ROLES);

const prisma = new PrismaClient();
const secrets = (): string[] => [ADMIN_SEED_PASSWORD ?? ''];
const clean = (s: string): string => redact(s, secrets());

function p(name: string): string {
  return `${RUN_DIR}/${name}`;
}
function writeJson(name: string, value: unknown): void {
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(p(name), clean(JSON.stringify(value, null, 2)) + '\n', 'utf8');
}
function readJson<T>(name: string): T | null {
  try {
    return existsSync(p(name))
      ? (JSON.parse(readFileSync(p(name), 'utf8')) as T)
      : null;
  } catch {
    return null;
  }
}
const log = (msg: string): void =>
  console.log(`[stage-5.17-c:control] ${clean(msg)}`);

// ---------------------------------------------------------------------------
// HTTP (envelope-unwrapping, like authenticated-qa-runner.ts / the 5.16-E verifier)
// ---------------------------------------------------------------------------

interface Api<T> {
  status: number;
  ok: boolean;
  body: T;
  message?: string;
}

async function api<T = unknown>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<Api<T>> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body && !(init.body instanceof FormData) && !headers['Content-Type'])
    headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_ORIGIN}${path}`, { ...init, headers });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  let body: unknown = parsed;
  let message: string | undefined;
  if (parsed && typeof parsed === 'object') {
    const env = parsed as {
      success?: boolean;
      data?: unknown;
      error?: { message?: unknown };
    };
    if (env.success === true) body = env.data;
    else if (env.success === false && typeof env.error?.message === 'string')
      message = env.error.message;
  }
  return { status: res.status, ok: res.ok, body: body as T, message };
}

async function adminLogin(): Promise<string> {
  if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD)
    throw new Error(
      'ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are not present in this container',
    );
  const res = await api<{ accessToken: string }>('/api/v1/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: ADMIN_SEED_EMAIL,
      password: ADMIN_SEED_PASSWORD,
    }),
  });
  if (!res.ok || typeof res.body?.accessToken !== 'string')
    throw new Error(
      `admin login failed: HTTP ${res.status}${res.message ? ' — ' + res.message : ''}`,
    );
  const me = await api<{ role: string }>('/api/v1/admin/auth/me', {
    token: res.body.accessToken,
  });
  if (!me.ok || me.body.role !== 'SUPER_ADMIN')
    throw new Error(`seeded admin is not SUPER_ADMIN (HTTP ${me.status})`);
  return res.body.accessToken;
}

// ---------------------------------------------------------------------------
// Persistent registry
// ---------------------------------------------------------------------------

interface Extras {
  storageKey?: string;
  bodySlug?: string;
  /** admin-user only: audit row ids attributed to the temporary user, captured BEFORE it is deleted (deletion nulls the actor). */
  auditRowIds?: string[];
}
interface StateFile {
  run: QaRun;
  startedAt: string;
  fixtures: Fixture[];
  extras: Record<string, Extras>;
}

class PersistentRegistry {
  readonly registry = new FixtureRegistry();
  readonly extras: Record<string, Extras> = {};
  constructor(
    readonly run: QaRun,
    readonly startedAt: string,
  ) {}

  register(
    name: string,
    type: FixtureType,
    id: string,
    marker: string,
    extra: Extras = {},
  ): void {
    this.registry.register(name, type, id, marker);
    this.extras[`${type}:${id}`] = {
      ...this.extras[`${type}:${id}`],
      ...extra,
    };
    this.save(); // persisted IMMEDIATELY — a later crash must not lose track of this object
  }

  save(): void {
    const state: StateFile = {
      run: this.run,
      startedAt: this.startedAt,
      fixtures: [...this.registry.all()],
      extras: this.extras,
    };
    writeJson(RUN_FILES.state, state);
  }

  static load(): PersistentRegistry | null {
    const state = readJson<StateFile>(RUN_FILES.state);
    if (!state) return null;
    const reg = new PersistentRegistry(state.run, state.startedAt);
    for (const f of state.fixtures) {
      reg.registry.register(f.name, f.type, f.id, f.marker);
      reg.registry.markCleanup(f.type, f.id, f.cleanup, f.cleanupDetail);
    }
    Object.assign(reg.extras, state.extras);
    // fixtures created BY the UI during the browser run (registered by the verifier)
    const dynamic: Array<{
      name: string;
      type: FixtureType;
      id: string;
      marker: string;
      storageKey?: string;
    }> = [];
    if (existsSync(p(RUN_FILES.dynamicFixtures))) {
      for (const line of readFileSync(
        p(RUN_FILES.dynamicFixtures),
        'utf8',
      ).split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          dynamic.push(JSON.parse(line) as (typeof dynamic)[number]);
        } catch {
          /* a torn last line from a crash — the tag sweep still finds the object */
        }
      }
    }
    for (const d of dynamic) {
      if (isUuid(d.id) && !reg.registry.has(d.type, d.id))
        reg.register(d.name, d.type, d.id, d.marker, {
          storageKey: d.storageKey,
        });
    }
    return reg;
  }
}

// ---------------------------------------------------------------------------
// Snapshots (checksums, public counts, real Home rows)
// ---------------------------------------------------------------------------

const IDREF = (t: string): string =>
  `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' order by id), '')) as md5 from ${t}`;

async function checksums(): Promise<TableChecksum[]> {
  const one = async (table: string, sql: string): Promise<TableChecksum> => {
    const rows =
      await prisma.$queryRawUnsafe<{ count: number; md5: string | null }[]>(
        sql,
      );
    return {
      table,
      count: Number(rows[0]?.count ?? 0),
      md5: rows[0]?.md5 ?? null,
    };
  };
  return Promise.all([
    one('card_products', IDREF('card_products')),
    one('category_cards', IDREF('category_cards')),
    one('categories', IDREF('categories')),
    one('services', IDREF('services')),
    one(
      'services.gallery',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("galleryMediaAssetIds"::text,'[]'), ',' order by id), '')) as md5 from services`,
    ),
  ]);
}

async function publicCounts(): Promise<PublicCounts> {
  const get = async (path: string): Promise<number> => {
    const r = await api<unknown[]>(path);
    if (!r.ok || !Array.isArray(r.body))
      throw new Error(`public GET ${path} failed: HTTP ${r.status}`);
    return r.body.length;
  };
  const [hero, banners, mosaic, news] = await Promise.all([
    get('/api/v1/home/hero-cards'),
    get('/api/v1/home/service-banners'),
    get('/api/v1/home/service-mosaic-tiles'),
    get('/api/v1/home/news-articles'),
  ]);
  return { hero, banners, mosaic, news };
}

const order = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
  { id: 'asc' as const },
];

async function homeRows(): Promise<HomeRowSnapshot[]> {
  const iso = (d: Date): string => d.toISOString();
  const [hero, banners, mosaic, news] = await Promise.all([
    prisma.homeHeroCard.findMany({
      orderBy: order,
      select: {
        id: true,
        active: true,
        sortOrder: true,
        updatedAt: true,
        updatedBy: true,
      },
    }),
    prisma.homeServiceBanner.findMany({
      orderBy: order,
      select: {
        id: true,
        active: true,
        sortOrder: true,
        mediaAssetId: true,
        categoryId: true,
        updatedAt: true,
        updatedBy: true,
      },
    }),
    prisma.homeServiceMosaicTile.findMany({
      orderBy: order,
      select: {
        id: true,
        active: true,
        sortOrder: true,
        mediaAssetId: true,
        categoryId: true,
        updatedAt: true,
        updatedBy: true,
      },
    }),
    prisma.homeNewsArticle.findMany({
      orderBy: order,
      select: {
        id: true,
        active: true,
        sortOrder: true,
        mediaAssetId: true,
        updatedAt: true,
        updatedBy: true,
      },
    }),
  ]);
  return [
    ...hero.map((r): HomeRowSnapshot => ({
      resource: 'hero',
      id: r.id,
      active: r.active,
      sortOrder: r.sortOrder,
      mediaAssetId: null,
      updatedAt: iso(r.updatedAt),
      updatedBy: r.updatedBy,
    })),
    ...banners.map((r): HomeRowSnapshot => ({
      resource: 'banner',
      id: r.id,
      active: r.active,
      sortOrder: r.sortOrder,
      mediaAssetId: r.mediaAssetId,
      categoryId: r.categoryId,
      updatedAt: iso(r.updatedAt),
      updatedBy: r.updatedBy,
    })),
    ...mosaic.map((r): HomeRowSnapshot => ({
      resource: 'mosaic',
      id: r.id,
      active: r.active,
      sortOrder: r.sortOrder,
      mediaAssetId: r.mediaAssetId,
      categoryId: r.categoryId,
      updatedAt: iso(r.updatedAt),
      updatedBy: r.updatedBy,
    })),
    ...news.map((r): HomeRowSnapshot => ({
      resource: 'news',
      id: r.id,
      active: r.active,
      sortOrder: r.sortOrder,
      mediaAssetId: r.mediaAssetId,
      updatedAt: iso(r.updatedAt),
      updatedBy: r.updatedBy,
    })),
  ];
}

interface Snapshot {
  takenAt: string;
  checksums: TableChecksum[];
  publicCounts: PublicCounts;
  homeRows: HomeRowSnapshot[];
}

async function snapshot(): Promise<Snapshot> {
  return {
    takenAt: new Date().toISOString(),
    checksums: await checksums(),
    publicCounts: await publicCounts(),
    homeRows: await homeRows(),
  };
}

function checksumText(rows: TableChecksum[]): string {
  return (
    rows.map((r) => `${r.table} | ${r.count} | ${r.md5}`).join('\n') + '\n'
  );
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function storage(): { client: S3Client; bucket: string } | undefined {
  const {
    STORAGE_ENDPOINT: endpoint,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY: accessKeyId,
    STORAGE_SECRET_KEY: secretAccessKey,
  } = process.env;
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

// ---------------------------------------------------------------------------
// A tiny real PNG
// ---------------------------------------------------------------------------

function qaPng(): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13);
  const w = Buffer.alloc(4);
  w.writeUInt32BE(8);
  const h = Buffer.alloc(4);
  h.writeUInt32BE(8);
  return Buffer.concat([
    signature,
    length,
    Buffer.from('IHDR', 'ascii'),
    w,
    h,
    Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
    Buffer.alloc(4),
  ]);
}

// ===========================================================================
// SETUP
// ===========================================================================

async function setup(): Promise<number> {
  mkdirSync(`${RUN_DIR}/${RUN_FILES.screenshotsDir}`, { recursive: true });
  const startedAt = new Date().toISOString();
  const blocked = (reason: string): number => {
    writeJson(RUN_FILES.setupResult, { status: 'BLOCKED', reason, startedAt });
    log(`BLOCKED: ${reason}`);
    return 3;
  };

  if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD)
    return blocked(
      'ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are not available to the container (no credentials — nothing was created)',
    );

  const run = makeQaRun(makeRunId(Date.now(), randomBytes(3).toString('hex')));
  const reg = new PersistentRegistry(run, startedAt);
  reg.save(); // an (empty) state exists from the very start, so teardown always has something to read
  log(`run ${run.runId}; tag ${run.tag}; slug prefix ${run.slugPrefix}`);

  let token: string;
  try {
    token = await adminLogin();
  } catch (err) {
    return blocked(
      `admin authentication failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let before: Snapshot;
  try {
    before = await snapshot();
  } catch (err) {
    return blocked(
      `BEFORE baseline could not be captured (no fixture was created): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  writeJson(RUN_FILES.before, before);
  writeFileSync(
    p(RUN_FILES.checksumsBefore),
    checksumText(before.checksums),
    'utf8',
  );

  // --- categories (existing rows, READ-ONLY; no QA category is ever created — `categories` has no DELETE endpoint) --------
  const cats = await api<{
    items: Array<{ id: string; name: string; active: boolean }>;
  }>('/api/v1/categories?limit=100');
  const catList =
    cats.ok && Array.isArray(cats.body?.items) ? cats.body.items : [];
  const activeCat = catList.find((c) => c.active);
  const inactiveCat = catList.find((c) => !c.active);

  const fixtures: ManifestFixture[] = [];
  const errors: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const make = async (
    name: string,
    type: FixtureType,
    fn: () => Promise<{
      id: string;
      marker: string;
      bodySlug?: string;
      storageKey?: string;
    }>,
  ): Promise<string | undefined> => {
    try {
      const created = await fn();
      if (!isUuid(created.id)) throw new Error('creation returned no uuid id');
      reg.register(name, type, created.id, created.marker, {
        bodySlug: created.bodySlug,
        storageKey: created.storageKey,
      });
      ids[name] = created.id;
      fixtures.push({
        name,
        type,
        id: created.id,
        marker: created.marker,
        bodySlug: created.bodySlug,
      });
      log(`fixture ${name} created`);
      return created.id;
    } catch (err) {
      errors[name] = clean(err instanceof Error ? err.message : String(err));
      log(`fixture ${name} FAILED: ${errors[name]}`);
      return undefined;
    }
  };
  const drop = (name: string, reason: string): void => {
    errors[name] = reason;
    const i = fixtures.findIndex((f) => f.name === name);
    if (i >= 0) fixtures.splice(i, 1);
    delete ids[name];
  };

  const uploadMedia = (suffix: string) => async () => {
    const fileName = makeQaFileName(run, suffix);
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(qaPng())], { type: 'image/png' }),
      fileName,
    );
    form.append('altText', `${run.tag} ${suffix}`);
    const res = await api<{ id: string }>('/api/v1/admin/media/upload', {
      method: 'POST',
      token,
      body: form,
    });
    if (!res.ok)
      throw new Error(
        `upload failed: HTTP ${res.status}${res.message ? ' — ' + res.message : ''}`,
      );
    // register BEFORE anything else can throw: look the storage key up now
    const row = await prisma.mediaAsset.findUnique({
      where: { id: res.body.id },
    });
    return { id: res.body.id, marker: fileName, storageKey: row?.key };
  };

  let sortOrder = 99900;
  const news =
    (name: string, extra: Record<string, unknown> = {}) =>
    async () => {
      const bodySlug = makeQaBodySlug(run, name.toLowerCase());
      assertValidBodySlug(bodySlug); // asserted BEFORE every News POST
      const marker = `${run.tag} ${name}`;
      const res = await api<{ id: string }>(
        '/api/v1/admin/home/news-articles',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            category: run.tag,
            kicker: marker,
            title: marker,
            lead: marker,
            bodySlug,
            sortOrder: sortOrder++,
            active: false,
            ...extra,
          }),
        },
      );
      if (!res.ok)
        throw new Error(
          `create failed (bodySlug=${bodySlug}): HTTP ${res.status}${res.message ? ' — ' + res.message : ''}`,
        );
      return { id: res.body.id, marker, bodySlug };
    };
  const banner =
    (name: string, categoryId: string, extra: Record<string, unknown> = {}) =>
    async () => {
      const marker = `${run.tag} ${name}`;
      const res = await api<{ id: string }>(
        '/api/v1/admin/home/service-banners',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            categoryId,
            kicker: marker,
            sortOrder: sortOrder++,
            active: false,
            ...extra,
          }),
        },
      );
      if (!res.ok)
        throw new Error(
          `create failed: HTTP ${res.status}${res.message ? ' — ' + res.message : ''}`,
        );
      return { id: res.body.id, marker };
    };

  // --- pagination padding: the active library must exceed one page (50) so pagination can be exercised ----------------
  let activeTotal: number | null = null;
  const totalRes = await api<{ total: number }>(
    '/api/v1/admin/media?page=1&limit=1',
    { token },
  );
  if (totalRes.ok) activeTotal = totalRes.body.total;
  if (activeTotal !== null && activeTotal < 60) {
    // padded BEFORE the named media so the named media are the NEWEST (page 1 of the newest-first list)
    for (let i = 0; i < 60 - activeTotal; i++) {
      await make(`mediaPad${i + 1}`, 'media', uploadMedia(`pad${i + 1}`));
      await new Promise((r) => setTimeout(r, 1100)); // stay well inside the global 100 req/min throttle
    }
  }

  // --- media -----------------------------------------------------------------------------------------------------------
  for (const [name, suffix] of [
    ['mediaA', 'a'],
    ['mediaB', 'b'],
    ['mediaC', 'c'],
    ['mediaD', 'd'],
    ['mediaD2', 'd2'],
    ['mediaE', 'e'],
  ] as const) {
    await make(name, 'media', uploadMedia(suffix));
  }
  if (ids.mediaC) {
    // soft-delete C through the API while unreferenced (the only way the guarded API allows it)
    const del = await api(`/api/v1/admin/media/${ids.mediaC}`, {
      method: 'DELETE',
      token,
    });
    if (!del.ok)
      drop(
        'mediaC',
        `soft-delete failed: HTTP ${del.status}${del.message ? ' — ' + del.message : ''}`,
      );
  }

  // --- news / banners / mosaic ---------------------------------------------------------------------------------------------
  await make('newsSlugOwner', 'news', news('newsSlugOwner'));
  if (ids.mediaA)
    await make(
      'newsMediaA',
      'news',
      news('newsMediaA', { mediaAssetId: ids.mediaA }),
    );
  else errors.newsMediaA = 'mediaA was not created';
  for (const name of [
    'newsLegacyReplace',
    'newsLegacyClear',
    'newsLegacyKeep',
    'newsStale',
    'newsStale2',
    'newsReorderA',
    'newsReorderB',
  ]) {
    await make(name, 'news', news(name));
  }
  if (activeCat) {
    if (ids.mediaA)
      await make(
        'bannerMediaA',
        'banner',
        banner('bannerMediaA', activeCat.id, { mediaAssetId: ids.mediaA }),
      );
    else errors.bannerMediaA = 'mediaA was not created';
    await make('bannerToggle', 'banner', banner('bannerToggle', activeCat.id));
    await make('bannerLegacy', 'banner', banner('bannerLegacy', activeCat.id));
    await make('mosaicWide', 'mosaic', async () => {
      const marker = `${run.tag} mosaicWide`;
      const res = await api<{ id: string }>(
        '/api/v1/admin/home/service-mosaic-tiles',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            categoryId: activeCat.id,
            slotType: 'wide',
            kicker: marker,
            title: marker,
            lead: marker,
            sortOrder: sortOrder++,
            active: false,
          }),
        },
      );
      if (!res.ok)
        throw new Error(
          `create failed: HTTP ${res.status}${res.message ? ' — ' + res.message : ''}`,
        );
      return { id: res.body.id, marker };
    });
  } else {
    for (const n of [
      'bannerMediaA',
      'bannerToggle',
      'bannerLegacy',
      'mosaicWide',
    ])
      errors[n] = 'no active category exists to reference';
  }
  if (inactiveCat)
    await make(
      'bannerInactiveCat',
      'banner',
      banner('bannerInactiveCat', inactiveCat.id),
    );
  else errors.bannerInactiveCat = 'no inactive category exists to reference';

  // --- legacy references: the ONLY direct-Prisma writes (QA row -> QA soft-deleted media), each ownership-proven ------------
  if (ids.mediaC) {
    const mediaC = await prisma.mediaAsset.findUnique({
      where: { id: ids.mediaC },
    });
    const cOk =
      !!mediaC &&
      !mediaC.active &&
      mediaC.fileName.includes(run.tag) &&
      reg.registry.has('media', ids.mediaC);
    for (const name of [
      'newsLegacyReplace',
      'newsLegacyClear',
      'newsLegacyKeep',
      'bannerLegacy',
    ]) {
      const id = ids[name];
      if (!id) continue;
      try {
        if (!cOk)
          throw new Error(
            'mediaC is not a proven, soft-deleted QA asset of this run',
          );
        const isNews = name.startsWith('news');
        const row = isNews
          ? await prisma.homeNewsArticle.findUnique({ where: { id } })
          : await prisma.homeServiceBanner.findUnique({ where: { id } });
        if (!row) throw new Error('row not found');
        assertOwnedByRun(run, reg.registry, isNews ? 'news' : 'banner', {
          id,
          markers: [
            isNews ? (row as { bodySlug: string | null }).bodySlug : null,
            isNews
              ? (row as { title: string }).title
              : (row as { kicker: string }).kicker,
          ],
        });
        if (isNews)
          await prisma.homeNewsArticle.update({
            where: { id },
            data: { mediaAssetId: ids.mediaC },
          });
        else
          await prisma.homeServiceBanner.update({
            where: { id },
            data: { mediaAssetId: ids.mediaC },
          });
        const back = await api<{
          mediaAssetId: string | null;
          image: string | null;
        }>(
          `/api/v1/admin/home/${isNews ? 'news-articles' : 'service-banners'}/${id}`,
          { token },
        );
        if (
          !back.ok ||
          back.body.mediaAssetId !== ids.mediaC ||
          back.body.image !== null
        ) {
          throw new Error(
            `read-back mismatch: mediaAssetId=${String(back.body?.mediaAssetId)} image=${String(back.body?.image)}`,
          );
        }
      } catch (err) {
        drop(
          name,
          `legacy-reference setup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } else {
    for (const n of [
      'newsLegacyReplace',
      'newsLegacyClear',
      'newsLegacyKeep',
      'bannerLegacy',
    ])
      if (!errors[n]) errors[n] = 'mediaC was not created/soft-deleted';
    for (const n of [
      'newsLegacyReplace',
      'newsLegacyClear',
      'newsLegacyKeep',
      'bannerLegacy',
    ])
      drop(n, errors[n]);
  }

  // --- temporary RBAC accounts (only when explicitly enabled; fully reversible except for audit rows) -----------------
  const availableRoles: string[] = [];
  const unavailableRoles: Record<string, string> = {};
  const roleCreds: Record<string, { email: string; password: string }> = {};
  if (PROVISION_ROLES) {
    for (const role of ['SUPPORT_VIEWER', 'CONTENT_EDITOR'] as const) {
      try {
        const password = randomBytes(24).toString('hex');
        const email = `qa-${role.toLowerCase().replace(/_/g, '-')}-${run.slugPrefix}@biawin-staging.qa.invalid`;
        const row = await prisma.adminUser.create({
          data: {
            email,
            passwordHash: await hashPassword(password),
            fullName: `QA ${role} (temporary, ${run.runId})`,
            role,
          },
        });
        reg.register(`admin-${role}`, 'admin-user', row.id, email);
        roleCreds[role] = { email, password };
        availableRoles.push(role);
      } catch (err) {
        unavailableRoles[role] =
          `provisioning failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    writeFileSync(p(RUN_FILES.roles), JSON.stringify(roleCreds), {
      encoding: 'utf8',
      mode: 0o600,
    });
    chmodSync(p(RUN_FILES.roles), 0o600);
  } else {
    for (const role of ['SUPPORT_VIEWER', 'CONTENT_EDITOR'])
      unavailableRoles[role] =
        'no account exists and temporary-account provisioning is not enabled (STAGE517C_PROVISION_ROLES != true)';
  }

  const manifest: Manifest = {
    runId: run.runId,
    tag: run.tag,
    slugPrefix: run.slugPrefix,
    adminOrigin: ADMIN_ORIGIN,
    apiOrigin: BROWSER_API_ORIGIN,
    commitSha: COMMIT_SHA,
    startedAt,
    fixtures,
    fixtureErrors: errors,
    slugs: {
      valid: makeQaBodySlug(run, 'uivalid'),
      unknownMedia: makeQaBodySlug(run, 'unknownmedia'),
    },
    categories: {
      activeId: activeCat?.id ?? null,
      activeName: activeCat?.name ?? null,
      inactiveId: inactiveCat?.id ?? null,
      inactiveName: inactiveCat?.name ?? null,
    },
    availableRoles,
    unavailableRoles,
    allowReorderMetadataTouch: ALLOW_REORDER_TOUCH,
    activeMediaTotal: activeTotal,
  };
  writeJson(RUN_FILES.manifest, manifest); // ids/tags/slugs only — never secrets
  writeJson(RUN_FILES.setupResult, {
    status: 'READY',
    startedAt,
    fixtureCount: fixtures.length,
    fixtureErrors: Object.keys(errors).length,
  });
  log(
    `setup complete: ${fixtures.length} fixtures, ${Object.keys(errors).length} unavailable`,
  );
  return 0;
}

// ===========================================================================
// CLEANUP / REMAINING
// ===========================================================================

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

/** Objects carrying this run's tag/slug that are not (yet) in the registry — created by the UI or by a partial failure. Adopted ONLY because they carry the tag. */
async function sweep(reg: PersistentRegistry): Promise<void> {
  const { tag, slugPrefix } = reg.run;
  const [news, banners, mosaic, hero, media, admins] = await Promise.all([
    prisma.homeNewsArticle.findMany({
      where: {
        OR: [
          { category: { contains: tag } },
          { kicker: { contains: tag } },
          { title: { contains: tag } },
          { bodySlug: { startsWith: slugPrefix } },
        ],
      },
      select: { id: true, title: true },
    }),
    prisma.homeServiceBanner.findMany({
      where: { kicker: { contains: tag } },
      select: { id: true, kicker: true },
    }),
    prisma.homeServiceMosaicTile.findMany({
      where: {
        OR: [{ kicker: { contains: tag } }, { title: { contains: tag } }],
      },
      select: { id: true, kicker: true },
    }),
    prisma.homeHeroCard.findMany({
      where: {
        OR: [{ label: { contains: tag } }, { title: { contains: tag } }],
      },
      select: { id: true, title: true },
    }),
    prisma.mediaAsset.findMany({
      where: { fileName: { contains: tag } },
      select: { id: true, fileName: true, key: true },
    }),
    prisma.adminUser.findMany({
      where: { email: { contains: slugPrefix } },
      select: { id: true, email: true },
    }),
  ]);
  const adopt = (
    type: FixtureType,
    id: string,
    marker: string,
    extra: Extras = {},
  ): void => {
    if (!reg.registry.has(type, id))
      reg.register(`swept-${type}`, type, id, marker, extra);
  };
  for (const r of news) adopt('news', r.id, r.title);
  for (const r of banners) adopt('banner', r.id, r.kicker);
  for (const r of mosaic) adopt('mosaic', r.id, r.kicker);
  for (const r of hero) adopt('hero', r.id, r.title);
  for (const r of media)
    adopt('media', r.id, r.fileName, { storageKey: r.key });
  for (const r of admins) adopt('admin-user', r.id, r.email);
}

interface CleanupEntry {
  name: string;
  type: FixtureType;
  id: string;
  ok: boolean;
  detail: string;
}

const RANK: Record<FixtureType, number> = {
  news: 0,
  banner: 0,
  mosaic: 0,
  hero: 0,
  media: 1,
  storage: 2,
  'admin-user': 3,
};

async function cleanupOne(
  reg: PersistentRegistry,
  f: Fixture,
  token: string | undefined,
): Promise<CleanupEntry> {
  const { run } = reg;
  const entry = (ok: boolean, detail: string): CleanupEntry => ({
    name: f.name,
    type: f.type,
    id: f.id,
    ok,
    detail,
  });
  try {
    // -------- rows -------------------------------------------------------------------------------------------------
    if (
      f.type === 'news' ||
      f.type === 'banner' ||
      f.type === 'mosaic' ||
      f.type === 'hero'
    ) {
      const find = () =>
        f.type === 'news'
          ? prisma.homeNewsArticle.findUnique({ where: { id: f.id } })
          : f.type === 'banner'
            ? prisma.homeServiceBanner.findUnique({ where: { id: f.id } })
            : f.type === 'mosaic'
              ? prisma.homeServiceMosaicTile.findUnique({ where: { id: f.id } })
              : prisma.homeHeroCard.findUnique({ where: { id: f.id } });
      const row = await find();
      if (!row) return entry(true, 'already absent');
      const r = row as unknown as Record<string, string | null>;
      assertOwnedByRun(run, reg.registry, f.type, {
        id: f.id,
        markers: [r.bodySlug, r.title, r.kicker, r.label, r.category],
      }); // ownership BEFORE any delete
      let via = 'API';
      const path =
        f.type === 'news'
          ? 'news-articles'
          : f.type === 'banner'
            ? 'service-banners'
            : f.type === 'mosaic'
              ? 'service-mosaic-tiles'
              : 'hero-cards';
      const res = token
        ? await api(`/api/v1/admin/home/${path}/${f.id}`, {
            method: 'DELETE',
            token,
          })
        : undefined;
      if (!res?.ok && res?.status !== 404) {
        via = 'Prisma (API delete unavailable)';
        if (f.type === 'news')
          await prisma.homeNewsArticle.delete({ where: { id: f.id } });
        else if (f.type === 'banner')
          await prisma.homeServiceBanner.delete({ where: { id: f.id } });
        else if (f.type === 'mosaic')
          await prisma.homeServiceMosaicTile.delete({ where: { id: f.id } });
        else await prisma.homeHeroCard.delete({ where: { id: f.id } });
      }
      if (await find())
        return entry(false, `row still present after delete via ${via}`);
      return entry(true, `deleted via ${via}`);
    }

    // -------- media (all five requirements) ------------------------------------------------------------------------------
    if (f.type === 'media') {
      const notes: string[] = [];
      const row = await prisma.mediaAsset.findUnique({ where: { id: f.id } });
      if (row) {
        if (!reg.registry.has('media', f.id))
          return entry(false, 'refusing: not a registered fixture'); // 1 registered
        if (!row.fileName.includes(run.tag))
          return entry(
            false,
            "refusing: fileName does not carry this run's QA tag",
          ); // 2+3 ownership + tag
        const refs = await countReferences(f.id);
        if (refs !== 0)
          return entry(false, `refusing: still referenced (${refs})`); // 4 zero references
        if (token) {
          const res = await api(`/api/v1/admin/media/${f.id}`, {
            method: 'DELETE',
            token,
          }); // best-effort soft delete first (may already be soft-deleted)
          notes.push(`API soft-delete HTTP ${res.status}`);
        }
        await prisma.mediaAsset.delete({ where: { id: f.id } }); // 5 expected id
        notes.push('row hard-deleted');
      } else notes.push('row already absent');
      const key = reg.extras[`media:${f.id}`]?.storageKey ?? row?.key;
      if (key)
        reg.extras[`media:${f.id}`] = {
          ...reg.extras[`media:${f.id}`],
          storageKey: key,
        }; // remembered so the post-cleanup HeadObject check can find it
      const store = storage();
      if (key) {
        if (!store)
          return entry(
            false,
            `${notes.join('; ')}; storage env unavailable — object could not be deleted`,
          );
        await store.client.send(
          new DeleteObjectCommand({ Bucket: store.bucket, Key: key }),
        );
        notes.push('storage object deleted');
      }
      return entry(true, notes.join('; '));
    }

    // -------- temporary admin accounts -----------------------------------------------------------------------------------
    if (f.type === 'admin-user') {
      const row = await prisma.adminUser.findUnique({ where: { id: f.id } });
      if (!row) return entry(true, 'already absent');
      if (!row.email.includes(run.slugPrefix))
        return entry(
          false,
          "refusing: email does not carry this run's slug prefix",
        );
      // Audit rows attributed to this user are counted (by id) BEFORE deletion: the FK is onDelete SetNull, so the rows
      // stay but lose their actor. They are never deleted, and the report says they REMAIN.
      const audit = await prisma.adminAuditLog.findMany({
        where: { adminUserId: f.id },
        select: { id: true },
      });
      reg.extras[`admin-user:${f.id}`] = {
        ...reg.extras[`admin-user:${f.id}`],
        auditRowIds: audit.map((a) => a.id),
      };
      reg.save();
      await prisma.adminUser.delete({ where: { id: f.id } });
      return entry(
        true,
        `temporary admin deleted (${audit.length} audit row(s) remain, actor now null)`,
      );
    }
    return entry(true, 'nothing to do');
  } catch (err) {
    return entry(
      false,
      clean(err instanceof Error ? err.message : String(err)),
    );
  }
}

async function teardown(): Promise<number> {
  const reg = PersistentRegistry.load();
  if (!reg) {
    writeJson(RUN_FILES.cleanup, {
      status: 'NO_STATE',
      entries: [],
      failed: 0,
      note: 'setup never created a state file — nothing to clean',
    });
    log('no state file — nothing to clean');
    return 0;
  }
  let token: string | undefined;
  try {
    token = await adminLogin();
  } catch (err) {
    log(
      `admin login unavailable for cleanup (${err instanceof Error ? err.message : String(err)}) — ownership-proven Prisma deletes will be used`,
    );
  }
  try {
    await sweep(reg);
  } catch (err) {
    log(`sweep failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const ordered = [...reg.registry.all()]
    .reverse()
    .sort((a, b) => RANK[a.type] - RANK[b.type]); // rows -> media -> admins; stable within a rank = reverse creation
  const entries: CleanupEntry[] = [];
  for (const f of ordered) {
    const e = await cleanupOne(reg, f, token);
    reg.registry.markCleanup(f.type, f.id, e.ok ? 'OK' : 'FAILED', e.detail);
    entries.push(e);
    log(`cleanup ${e.ok ? 'OK' : 'FAILED'}: ${f.type} ${f.name} — ${e.detail}`);
  }
  reg.save();
  if (existsSync(p(RUN_FILES.roles))) unlinkSync(p(RUN_FILES.roles)); // temporary-role credentials never outlive teardown
  const failed = entries.filter((e) => !e.ok).length;
  writeJson(RUN_FILES.cleanup, {
    status: failed === 0 ? 'OK' : 'FAILED',
    entries,
    failed,
  });
  return failed === 0 ? 0 : 1;
}

interface RemainingFixture {
  type: string;
  id: string;
  marker: string;
  cleanup: string;
}

async function findRemaining(
  reg: PersistentRegistry,
): Promise<RemainingFixture[]> {
  const out = new Map<string, RemainingFixture>();
  const add = (type: string, id: string, marker: string): void => {
    const f = reg.registry.all().find((x) => x.id === id);
    out.set(`${type}:${id}`, {
      type,
      id,
      marker,
      cleanup: f
        ? `${f.cleanup}${f.cleanupDetail ? ` (${f.cleanupDetail})` : ''}`
        : 'not registered (found by tag sweep)',
    });
  };
  const store = storage();
  for (const f of reg.registry.all()) {
    if (
      f.type === 'news' &&
      (await prisma.homeNewsArticle.findUnique({ where: { id: f.id } }))
    )
      add('home_news_articles', f.id, f.marker);
    if (
      f.type === 'banner' &&
      (await prisma.homeServiceBanner.findUnique({ where: { id: f.id } }))
    )
      add('home_service_banners', f.id, f.marker);
    if (
      f.type === 'mosaic' &&
      (await prisma.homeServiceMosaicTile.findUnique({ where: { id: f.id } }))
    )
      add('home_service_mosaic_tiles', f.id, f.marker);
    if (
      f.type === 'hero' &&
      (await prisma.homeHeroCard.findUnique({ where: { id: f.id } }))
    )
      add('home_hero_cards', f.id, f.marker);
    if (
      f.type === 'admin-user' &&
      (await prisma.adminUser.findUnique({ where: { id: f.id } }))
    )
      add('admin_users', f.id, f.marker);
    if (f.type === 'media') {
      if (await prisma.mediaAsset.findUnique({ where: { id: f.id } }))
        add('media_assets', f.id, f.marker);
      const key = reg.extras[`media:${f.id}`]?.storageKey;
      if (key && store) {
        try {
          await store.client.send(
            new HeadObjectCommand({ Bucket: store.bucket, Key: key }),
          );
          add('storage_object', key, f.marker); // HeadObject succeeded => the object still exists
        } catch {
          /* NotFound == cleaned */
        }
      } else if (key && !store)
        add(
          'storage_object',
          key,
          `${f.marker} (storage env unavailable — could not verify)`,
        );
    }
  }
  // tag / slug sweep: anything carrying this run's tag, registered or not
  const { tag, slugPrefix } = reg.run;
  const [news, banners, mosaic, hero, media, admins] = await Promise.all([
    prisma.homeNewsArticle.findMany({
      where: {
        OR: [
          { category: { contains: tag } },
          { kicker: { contains: tag } },
          { title: { contains: tag } },
          { bodySlug: { startsWith: slugPrefix } },
        ],
      },
      select: { id: true, title: true },
    }),
    prisma.homeServiceBanner.findMany({
      where: { kicker: { contains: tag } },
      select: { id: true, kicker: true },
    }),
    prisma.homeServiceMosaicTile.findMany({
      where: {
        OR: [{ kicker: { contains: tag } }, { title: { contains: tag } }],
      },
      select: { id: true, kicker: true },
    }),
    prisma.homeHeroCard.findMany({
      where: {
        OR: [{ label: { contains: tag } }, { title: { contains: tag } }],
      },
      select: { id: true, title: true },
    }),
    prisma.mediaAsset.findMany({
      where: { fileName: { contains: tag } },
      select: { id: true, fileName: true },
    }),
    prisma.adminUser.findMany({
      where: { email: { contains: slugPrefix } },
      select: { id: true, email: true },
    }),
  ]);
  for (const r of news) add('home_news_articles', r.id, r.title);
  for (const r of banners) add('home_service_banners', r.id, r.kicker);
  for (const r of mosaic) add('home_service_mosaic_tiles', r.id, r.kicker);
  for (const r of hero) add('home_hero_cards', r.id, r.title);
  for (const r of media) add('media_assets', r.id, r.fileName);
  for (const r of admins) add('admin_users', r.id, r.email);
  return [...out.values()];
}

// ===========================================================================
// VERIFY (AFTER snapshot, remaining fixtures, merge, verdict, report)
// ===========================================================================

interface BrowserResults {
  outcomes: BrowserOutcome[];
  startedAt?: string;
  endedAt?: string;
  consoleErrors?: number;
  crashed?: string;
}

async function verify(): Promise<number> {
  const setupResult = readJson<{
    status: string;
    reason?: string;
    startedAt?: string;
  }>(RUN_FILES.setupResult);
  const blockedReason =
    setupResult?.status === 'BLOCKED'
      ? (setupResult.reason ?? 'setup blocked')
      : setupResult
        ? null
        : 'setup did not run';
  const reg = PersistentRegistry.load();
  const before = readJson<Snapshot>(RUN_FILES.before);
  const cleanupFile = readJson<{
    status: string;
    failed: number;
    entries: CleanupEntry[];
  }>(RUN_FILES.cleanup);
  const browser = readJson<BrowserResults>(RUN_FILES.browserResults);
  const firewall = readJson<FirewallEvent[]>(RUN_FILES.firewallEvents) ?? [];
  const manifest = readJson<Manifest>(RUN_FILES.manifest);

  // ---- AFTER evidence — never skipped because something earlier failed ----
  let after: Snapshot | null = null;
  let afterError = '';
  try {
    after = await snapshot();
    writeJson(RUN_FILES.after, after);
    writeFileSync(
      p(RUN_FILES.checksumsAfter),
      checksumText(after.checksums),
      'utf8',
    );
  } catch (err) {
    afterError = err instanceof Error ? err.message : String(err);
  }
  let remaining: RemainingFixture[] = [];
  let remainingError = '';
  if (reg) {
    try {
      remaining = await findRemaining(reg);
    } catch (err) {
      remainingError = err instanceof Error ? err.message : String(err);
      remaining = [
        {
          type: 'unknown',
          id: 'query-failed',
          marker: remainingError,
          cleanup: 'UNKNOWN',
        },
      ];
    }
  }
  writeJson(RUN_FILES.remaining, remaining);

  const checksumCmp =
    before && after
      ? compareChecksums(before.checksums, after.checksums)
      : { ok: false, diffs: [] };
  const qaIds = new Set<string>(reg ? reg.registry.all().map((f) => f.id) : []);
  const baselineCmp =
    before && after
      ? compareHomeBaseline(
          before.homeRows,
          after.homeRows,
          (r) => qaIds.has(r.id),
          { ignoreUpdateMetadata: ALLOW_REORDER_TOUCH },
        )
      : {
          ok: false,
          problems: [
            before
              ? `AFTER snapshot failed: ${afterError}`
              : 'no BEFORE snapshot exists',
          ],
        };
  const countsOk =
    before && after
      ? publicCountsEqual(before.publicCounts, after.publicCounts)
      : false;

  const outcomes = mergeOutcomes(
    QA_TESTS,
    browser?.outcomes ?? [],
    blockedReason,
  );
  const cleanupFailures = cleanupFile
    ? cleanupFile.failed
    : reg && reg.registry.all().length > 0
      ? reg.registry.all().length
      : cleanupFile === null && reg
        ? 1
        : 0;
  const verdict = finalVerdict({
    outcomes,
    cleanupFailures:
      cleanupFile === null && reg && reg.registry.all().length > 0
        ? 1
        : cleanupFailures,
    remainingFixtures: remaining.length,
    checksumsOk: checksumCmp.ok,
    homeBaselineOk: baselineCmp.ok,
    publicCountsOk: countsOk,
    firewallViolations: countFirewallViolations(firewall),
  });
  if (browser?.crashed)
    verdict.reasons.push(`browser verifier crashed: ${browser.crashed}`);
  if (browser?.crashed && verdict.status === 'PASS')
    Object.assign(verdict, { status: 'FAIL', exitCode: 1 });

  const tempUsers = reg
    ? reg.registry.all().filter((f) => f.type === 'admin-user')
    : [];
  const auditIds = tempUsers.flatMap(
    (f) => reg?.extras[`admin-user:${f.id}`]?.auditRowIds ?? [],
  );
  let auditRemaining = auditIds.length; // conservative if the count cannot be taken: assume they all remain
  try {
    auditRemaining = auditIds.length
      ? await prisma.adminAuditLog.count({ where: { id: { in: auditIds } } })
      : 0;
  } catch {
    /* keep the conservative value */
  }
  const auditResidue: AuditResidue = {
    temporaryUsersCreated: tempUsers.length,
    temporaryUsersDeleted: tempUsers.filter(
      (f) => !remaining.some((r) => r.type === 'admin_users' && r.id === f.id),
    ).length,
    auditRowsCreatedByTemporaryUsers: auditIds.length,
    auditRowsRemaining: auditRemaining,
  };

  const counts = tally(outcomes);
  const endedAt = new Date().toISOString();
  const report = {
    stage: '5.17-C (implemented in 5.17-D)',
    runId: reg?.run.runId ?? null,
    tag: reg?.run.tag ?? null,
    commitSha: COMMIT_SHA,
    startedAt: setupResult?.startedAt ?? null,
    endedAt,
    apiOrigin: manifest?.apiOrigin ?? BROWSER_API_ORIGIN,
    adminOrigin: manifest?.adminOrigin ?? ADMIN_ORIGIN,
    verdict,
    tally: counts,
    capabilities: {
      allowReorderMetadataTouch: ALLOW_REORDER_TOUCH,
      availableRoles: manifest?.availableRoles ?? [],
      unavailableRoles: manifest?.unavailableRoles ?? {},
    },
    setup: setupResult,
    fixtureErrors: manifest?.fixtureErrors ?? {},
    outcomes,
    heroReport: heroReport(outcomes),
    fixtures: reg
      ? reg.registry.all().map((f) => ({
          name: f.name,
          type: f.type,
          id: f.id,
          marker: f.marker,
          cleanup: f.cleanup,
          cleanupDetail: f.cleanupDetail,
        }))
      : [],
    cleanup: cleanupFile,
    remainingFixtures: remaining,
    checksums: { ok: checksumCmp.ok, diffs: checksumCmp.diffs },
    homeBaseline: {
      ok: baselineCmp.ok,
      problems: baselineCmp.problems,
      before: before?.publicCounts ?? null,
      after: after?.publicCounts ?? null,
    },
    firewall: {
      violations: countFirewallViolations(firewall),
      events: firewall.map((e) => ({ ...e, path: templatePath(e.path) })),
    },
    auditResidue,
    auditResidueLines: formatAuditResidue(auditResidue),
  };
  writeJson(RUN_FILES.reportJson, report);

  const lines: string[] = [];
  lines.push(`Stage 5.17-C Home Admin Browser QA — ${endedAt}`);
  lines.push(
    `Run: ${report.runId} | tag: ${report.tag} | commit: ${COMMIT_SHA}`,
  );
  lines.push(`Started: ${report.startedAt} | Ended: ${endedAt}`);
  lines.push(`Admin: ${report.adminOrigin} | API: ${report.apiOrigin}`);
  lines.push(`VERDICT: ${verdict.status} (exit ${verdict.exitCode})`);
  for (const r of verdict.reasons) lines.push(`  - ${r}`);
  lines.push('');
  lines.push(
    `Tests: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.NOT_RUN} NOT_RUN, ${counts.BLOCKED} BLOCKED (of ${QA_TESTS.length})`,
  );
  for (const o of outcomes)
    lines.push(
      `${o.status.padEnd(8)} ${o.id.padEnd(8)} [${o.klass ?? '?'}] ${o.detail}`,
    );
  lines.push('');
  lines.push('Hero coverage (no real Hero row is ever mutated):');
  for (const h of report.heroReport)
    lines.push(`  ${h.id}: ${h.status} — ${h.mode}`);
  lines.push('');
  lines.push(
    `Capabilities: reorder metadata touch=${ALLOW_REORDER_TOUCH}; roles available=[${report.capabilities.availableRoles.join(', ')}]`,
  );
  for (const [role, why] of Object.entries(
    report.capabilities.unavailableRoles,
  ))
    lines.push(`  ${role} unavailable: ${why}`);
  lines.push('');
  lines.push(
    `Fixtures created: ${report.fixtures.length}; unavailable: ${Object.keys(report.fixtureErrors).length}`,
  );
  for (const [n, why] of Object.entries(report.fixtureErrors))
    lines.push(`  NOT CREATED ${n}: ${why}`);
  lines.push(
    `Cleanup: ${cleanupFile?.status ?? 'NOT RUN'} (${cleanupFile?.failed ?? '?'} failed)`,
  );
  for (const e of cleanupFile?.entries.filter((x) => !x.ok) ?? [])
    lines.push(`  CLEANUP FAILED ${e.type} ${e.id}: ${e.detail}`);
  lines.push(`Remaining fixtures: ${remaining.length}`);
  for (const r of remaining)
    lines.push(`  REMAINS ${r.type} ${r.id} | ${r.marker} | ${r.cleanup}`);
  lines.push('');
  lines.push(
    `Protected checksums BEFORE == AFTER: ${checksumCmp.ok ? 'PASS' : 'FAIL'}`,
  );
  for (const d of checksumCmp.diffs)
    lines.push(
      `  ${d.match ? 'OK  ' : 'DIFF'} ${d.table}: ${d.before} -> ${d.after}`,
    );
  lines.push(
    `Home baseline restored: ${baselineCmp.ok ? 'PASS' : 'FAIL'}; public counts restored: ${countsOk ? 'PASS' : 'FAIL'}`,
  );
  for (const pr of baselineCmp.problems) lines.push(`  ${pr}`);
  lines.push(
    `Mutation firewall: ${countFirewallViolations(firewall)} blocked mutation(s) across ${firewall.length} recorded event(s)`,
  );
  for (const e of firewall.filter((x) => !x.allowed))
    lines.push(
      `  BLOCKED [${e.testId}] ${e.method} ${templatePath(e.path)} — ${e.reason}`,
    );
  lines.push('');
  lines.push('Audit residue (temporary QA users):');
  for (const l of report.auditResidueLines) lines.push(`  ${l}`);
  const text = clean(lines.join('\n'));
  writeFileSync(p(RUN_FILES.reportTxt), text + '\n', 'utf8');
  console.log('\n' + text);
  return verdict.exitCode;
}

// ===========================================================================

async function main(): Promise<number> {
  const command = process.argv[2];
  if (command === 'setup') return setup();
  if (command === 'teardown') return teardown();
  if (command === 'verify') return verify();
  console.error('usage: control.js setup|teardown|verify');
  return 2;
}

main()
  .then(async (code) => {
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = code;
  })
  .catch(async (err: unknown) => {
    console.error(
      '[stage-5.17-c:control] fatal:',
      clean(err instanceof Error ? err.message : String(err)),
    );
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  });
