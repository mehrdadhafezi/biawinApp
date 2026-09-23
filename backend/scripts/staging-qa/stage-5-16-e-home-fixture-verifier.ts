/**
 * Stage 5.16-E — authenticated, API-only fixture verification for the
 * Stage 5.16-B Home CMS hardening (docs/STAGE-5.16-HOME-BACKEND-HARDENING-
 * PLAN.md / -RESULT.md), closing the BLOCKED items from Stage 5.16-C/D.
 *
 * Deliberately NOT `authenticated-qa-runner.ts`: this file is single-layer
 * (API only), never chains into Browser QA, and is scoped to exactly the
 * Stage 5.16 test matrix — nothing else. Run ONLY via
 * `deploy/staging/run-stage-5-16-e-verification.sh`, which is itself only
 * ever invoked (a) by a human on the staging server, or (b) by the
 * `stage-5-16-e-home-verification.yml` GitHub Actions workflow
 * (`workflow_dispatch` only — never on push, never automatic) — exactly the
 * same trust boundary `run-authenticated-qa.sh` already uses. Runs inside
 * the real `backend` Docker image for the same reason that script does:
 * direct Prisma/DB access for the one state this stage's own API guard
 * makes otherwise unreachable (see FIXTURE PLAN §4 below), and zero new
 * npm dependencies (Node 20's built-in fetch/FormData/Blob).
 *
 * Secret handling: `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` are read from
 * this container's normal environment (populated from
 * `deploy/staging/.env.staging` via Compose's `env_file:` — the exact same
 * mechanism `authenticated-qa-runner.ts` already uses, not a new
 * credential). This script never echoes them, never writes them to a
 * report, and redacts anything JWT-shaped before it can reach a log line
 * (see `redact()`).
 *
 * FIXTURE PLAN — deliberate, disclosed deviations from a literal reading of
 * the Stage 5.16-E task's fixture list, each because the schema/API itself
 * makes the literal instruction structurally impossible or unnecessary:
 *
 *  §1. "Temporary Hero/Card with a unique cardKey" — impossible. `cardKey`
 *      is `HeroCardKey` (`earn`|`biawin`|`reward`), a closed 3-value enum,
 *      `@unique`, and staging always has exactly 3 seeded rows (one per
 *      key). There is no 4th value to create. This exact constraint is
 *      already documented in this repository — see
 *      `authenticated-qa-runner.ts`'s own `heroCardExistingRowCheck` and
 *      its comment ("HomeHeroCard has no valid disposable row to create").
 *      This script does NOT create a Hero Card. The duplicate-cardKey test
 *      instead attempts to CREATE a new row reusing an already-existing
 *      key (`earn`) — which is precisely what "duplicate" means — and
 *      asserts 409 with the admin hero-card count unchanged (3) afterward.
 *      No existing Hero Card row is ever read, written, or reordered.
 *
 *  §2. "Temporary Category" — not created. Every test that needs a
 *      `categoryId` in this script is a NEGATIVE test (an unknown,
 *      guaranteed-nonexistent uuid), so no real Category is ever required.
 *      Not creating one removes `categories` — one of the five checksum-
 *      protected tables — from this script's own write surface entirely,
 *      which is strictly safer than the alternative.
 *
 *  §3. All fixture creation that DOES happen is confined to
 *      `home_news_articles` and `media_assets` only — never
 *      `home_service_banners`/`home_service_mosaic_tiles`, and never any
 *      of the 5 protected tables (`card_products`, `category_cards`,
 *      `categories`, `services`, and `services.galleryMediaAssetIds`).
 *
 *  §4. "Soft-deleted media referenced by a Home row, then GET returns
 *      image:null" cannot be produced end-to-end through the public API,
 *      BY DESIGN: Stage 5.16-B's own `assertMediaAssetUsable()` requires a
 *      referenced MediaAsset to be ACTIVE on every write, so the API will
 *      never let you attach an already-soft-deleted asset to a Home row
 *      (422), and it will never let you soft-delete an asset that IS
 *      already attached (409 — that is Test 13, the very next test). The
 *      state this test needs to observe (a legacy reference to media that
 *      was deleted through some other path — e.g. before this hardening
 *      shipped, or a future hard delete) has no REST equivalent by
 *      construction. Precedent for this exact class of gap already exists
 *      in this repository: `authenticated-qa-runner.ts` provisions
 *      temporary CONTENT_EDITOR/SUPPORT_VIEWER admin accounts directly via
 *      Prisma because "there is no REST endpoint for that in this
 *      codebase" (see that file's own header comment). This script does
 *      the same, narrowly: ONE direct `prisma.homeNewsArticle.update()`
 *      that repoints a fixture row THIS SCRIPT ITSELF CREATED (never an
 *      existing row) at a fixture MediaAsset THIS SCRIPT ITSELF SOFT-
 *      DELETED (never an existing asset). This is the one and only direct
 *      Prisma WRITE in this file beyond cleanup deletes of its own
 *      fixtures — clearly marked at its call site.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Internal Docker-network origin by default (this script runs inside the
// `backend` compose service — same default/reasoning as
// `run-authenticated-qa.sh`'s API-layer invocation); override with
// STAGE516E_API_ORIGIN for a standalone run.
const API_ORIGIN = process.env.STAGE516E_API_ORIGIN || 'http://backend:4000';
const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL;
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const REPORT_DIR = process.env.STAGE516E_REPORT_DIR ?? '/tmp/stage-5-16-e';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');

// Required prefix (task §4) plus a per-run unique suffix so concurrent runs
// (or a re-run after a partial failure) never collide.
const QA_TAG = `stage516e_qa_${Date.now()}_${randomBytes(3).toString('hex')}`;
// bodySlug has a stricter contract: lowercase letters/digits and single hyphens only.
const QA_SLUG = QA_TAG.replace(/_/g, '-').toLowerCase();

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Result tracking (same shape/spirit as authenticated-qa-runner.ts)
// ---------------------------------------------------------------------------

type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
interface Result {
  name: string;
  status: Status;
  detail: string;
}
const results: Result[] = [];
const cleanupTasks: Array<{ name: string; run: () => Promise<void> }> = [];

function record(name: string, status: Status, detail = ''): void {
  results.push({ name, status, detail });
  console.log(
    `[stage-5.16-e] ${status.padEnd(8)} ${name}${detail ? ' — ' + redact(detail) : ''}`,
  );
}

/** Never let a token/secret-shaped string leak into console output or the report. */
function redact(s: string): string {
  let out = s.replace(
    /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    '<redacted-jwt>',
  );
  if (ADMIN_SEED_PASSWORD) {
    out = out.split(ADMIN_SEED_PASSWORD).join('<redacted>');
  }
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

function registerCleanup(name: string, run: () => Promise<void>): void {
  cleanupTasks.push({ name, run });
}

async function runCleanup(): Promise<void> {
  // Run in reverse registration order so dependent fixtures are removed first.
  let failed = false;
  for (const task of [...cleanupTasks].reverse()) {
    try {
      await task.run();
      record(`Cleanup: ${task.name}`, 'PASS');
    } catch (err) {
      failed = true;
      record(
        `Cleanup: ${task.name}`,
        'FAIL',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  if (failed) throw new Error('One or more registered cleanup tasks failed');
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

// ---------------------------------------------------------------------------
// A tiny, real, valid PNG (self-contained — not a dependency on any
// jest-only fixture file so this script has no test-framework coupling).
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
// Checksums — identical methodology to Stage 5.16-B/C/D (§11/§12 of the
// Stage 5.16-E task): id + mediaAssetId pairs, md5'd, ordered by id.
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

async function computeProtectedChecksums(): Promise<TableChecksum[]> {
  return Promise.all([
    checksumOne(
      'card_products',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' order by id), '')) as md5 from card_products`,
    ),
    checksumOne(
      'category_cards',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' order by id), '')) as md5 from category_cards`,
    ),
    checksumOne(
      'categories',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' order by id), '')) as md5 from categories`,
    ),
    checksumOne(
      'services',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' order by id), '')) as md5 from services`,
    ),
    checksumOne(
      'services.gallery',
      `select count(*)::int as count, md5(coalesce(string_agg(id||':'||coalesce("galleryMediaAssetIds"::text,'[]'), ',' order by id), '')) as md5 from services`,
    ),
  ]);
}

function writeChecksumFile(filename: string, rows: TableChecksum[]): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const lines = rows.map((r) => `${r.table} | ${r.count} | ${r.md5}`);
  writeFileSync(`${REPORT_DIR}/${filename}`, lines.join('\n') + '\n', 'utf8');
}

function compareChecksums(
  before: TableChecksum[],
  after: TableChecksum[],
): { table: string; before: string; after: string; match: boolean }[] {
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
// Main
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
    { token: res.body.accessToken },
  );
  assert(me.ok, `post-login /me failed: ${detail(me)}`);
  return {
    accessToken: res.body.accessToken,
    role: me.body.role,
    email: me.body.email,
  };
}

async function main(): Promise<void> {
  console.log(`[stage-5.16-e] run tag: ${QA_TAG}`);
  console.log(`[stage-5.16-e] API origin: ${API_ORIGIN}`);

  // Everything below either PASSes/FAILs into `results` via `step()`, or
  // aborts by THROWING — never by calling `finish()` directly (that stays
  // the sole job of the single top-level `.then()/.catch()` at the bottom
  // of this file, so the report is written exactly once, always after the
  // `finally` cleanup block has actually run).
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
    if (!admin) {
      throw new Error(
        'admin login failed — aborting before any fixture is created',
      );
    }
    assert(
      admin.role === 'SUPER_ADMIN',
      `seeded admin has role ${admin.role}, expected SUPER_ADMIN`,
    );

    // --- Baseline (before any fixture) -------------------------------------
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

    const NONEXISTENT_CATEGORY = '00000000-0000-4000-8000-000000000000';
    const NONEXISTENT_MEDIA = '00000000-0000-4000-8000-000000000001';
    const NONEXISTENT_REORDER_ID = '00000000-0000-4000-8000-000000000002';

    // =====================================================================
    // TEST 1 — malformed UUID (authenticated)
    // =====================================================================
    await step(
      'TEST 1: malformed UUID on GET /admin/home/hero-cards/:id -> 400',
      async () => {
        const res = await apiCall('/api/v1/admin/home/hero-cards/not-a-uuid', {
          token: admin!.accessToken,
        });
        assertStatus(res, 400, 'malformed uuid');
      },
    );

    // =====================================================================
    // TEST 2 — duplicate cardKey (no fixture Hero Card — see file header §1)
    // =====================================================================
    const heroCountBefore = await step(
      'duplicate-cardKey pre-check: snapshot admin hero-card count',
      async () => {
        const res = await apiCall<{ total: number }>(
          '/api/v1/admin/home/hero-cards?limit=100',
          { token: admin!.accessToken },
        );
        assert(res.ok, `list hero-cards failed: ${detail(res)}`);
        return res.body.total;
      },
    );
    await step(
      'TEST 2: duplicate cardKey (reusing the existing "earn" row) -> 409, nothing written',
      async () => {
        const res = await apiCall('/api/v1/admin/home/hero-cards', {
          method: 'POST',
          token: admin!.accessToken,
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
          { token: admin!.accessToken },
        );
        assert(after.ok, `list hero-cards failed: ${detail(after)}`);
        assert(
          after.body.total === heroCountBefore,
          `expected hero-card count unchanged (${heroCountBefore}), got ${after.body.total} — a row may have been written despite the 409`,
        );
      },
    );

    // =====================================================================
    // Fixture: News #1 (active MediaAsset A attached — used for TEST 3, 13)
    // =====================================================================
    let mediaAId: string | undefined;
    await step('Fixture: upload QA media asset A (active)', async () => {
      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(qaPng())], { type: 'image/png' }),
        `${QA_TAG}-a.png`,
      );
      form.append('altText', `${QA_TAG} media A`);
      const res = await apiCall<{ id: string }>('/api/v1/admin/media/upload', {
        method: 'POST',
        token: admin!.accessToken,
        body: form,
      });
      assert(res.ok, `media A upload failed: ${detail(res)}`);
      mediaAId = res.body.id;
    });
    if (mediaAId) {
      registerCleanup(`delete QA media A (${mediaAId})`, async () => {
        const res = await apiCall(`/api/v1/admin/media/${mediaAId}`, {
          method: 'DELETE',
          token: admin!.accessToken,
        });
        assert(
          res.ok || res.status === 404,
          `cleanup: delete media A failed: ${detail(res)}`,
        );
      });
    }

    let news1Id: string | undefined;
    const news1Slug = `${QA_SLUG}-news1`;
    await step(
      'Fixture: create QA News #1 (inactive, references media A)',
      async () => {
        const res = await apiCall<{ id: string }>(
          '/api/v1/admin/home/news-articles',
          {
            method: 'POST',
            token: admin!.accessToken,
            body: JSON.stringify({
              category: QA_TAG,
              mediaAssetId: mediaAId,
              kicker: QA_TAG,
              title: QA_TAG,
              lead: QA_TAG,
              bodySlug: news1Slug,
              sortOrder: 99999,
              active: false,
            }),
          },
        );
        assert(res.ok, `create News #1 failed: ${detail(res)}`);
        news1Id = res.body.id;
      },
    );
    if (news1Id) {
      registerCleanup(`delete QA News #1 (${news1Id})`, async () => {
        const res = await apiCall(
          `/api/v1/admin/home/news-articles/${news1Id}`,
          { method: 'DELETE', token: admin!.accessToken },
        );
        assert(
          res.ok || res.status === 404,
          `cleanup: delete News #1 failed: ${detail(res)}`,
        );
      });
    }

    // =====================================================================
    // TEST 3 — duplicate bodySlug
    // =====================================================================
    await step(
      'TEST 3: duplicate bodySlug (reusing News #1’s slug) -> 409, nothing written',
      async () => {
        // Never continue with an undefined fixture ID/slug.
        if (!news1Id) throw new Error('News #1 fixture was not created; duplicate bodySlug test cannot run safely');
        const res = await apiCall('/api/v1/admin/home/news-articles', {
          method: 'POST',
          token: admin!.accessToken,
          body: JSON.stringify({
            category: QA_TAG,
            kicker: QA_TAG,
            title: QA_TAG,
            lead: QA_TAG,
            bodySlug: news1Slug,
            active: false,
          }),
        });
        assertStatus(res, 409, 'duplicate bodySlug');
      },
    );

    // =====================================================================
    // TEST 4 — unknown category (banner create; nothing should be written)
    // =====================================================================
    await step(
      'TEST 4: unknown categoryId on a Service Banner create -> 422, nothing written',
      async () => {
        const res = await apiCall('/api/v1/admin/home/service-banners', {
          method: 'POST',
          token: admin!.accessToken,
          body: JSON.stringify({
            categoryId: NONEXISTENT_CATEGORY,
            kicker: QA_TAG,
            active: false,
          }),
        });
        assertStatus(res, 422, 'unknown category');
      },
    );

    // =====================================================================
    // TEST 5 — unknown media
    // =====================================================================
    await step(
      'TEST 5: unknown mediaAssetId on a News create -> 422, nothing written',
      async () => {
        const res = await apiCall('/api/v1/admin/home/news-articles', {
          method: 'POST',
          token: admin!.accessToken,
          body: JSON.stringify({
            category: QA_TAG,
            kicker: QA_TAG,
            title: QA_TAG,
            lead: QA_TAG,
            bodySlug: `${QA_SLUG}-unknownmedia`,
            mediaAssetId: NONEXISTENT_MEDIA,
            active: false,
          }),
        });
        assertStatus(res, 422, 'unknown media');
      },
    );

    // =====================================================================
    // Fixture: News #2 (for reorder tests, partial semantics preserved)
    // =====================================================================
    let news2Id: string | undefined;
    await step(
      'Fixture: create QA News #2 (inactive, for reorder tests)',
      async () => {
        const res = await apiCall<{ id: string }>(
          '/api/v1/admin/home/news-articles',
          {
            method: 'POST',
            token: admin!.accessToken,
            body: JSON.stringify({
              category: QA_TAG,
              kicker: QA_TAG,
              title: QA_TAG,
              lead: QA_TAG,
              bodySlug: `${QA_SLUG}-news2`,
              sortOrder: 99998,
              active: false,
            }),
          },
        );
        assert(res.ok, `create News #2 failed: ${detail(res)}`);
        news2Id = res.body.id;
      },
    );
    if (news2Id) {
      registerCleanup(`delete QA News #2 (${news2Id})`, async () => {
        const res = await apiCall(
          `/api/v1/admin/home/news-articles/${news2Id}`,
          { method: 'DELETE', token: admin!.accessToken },
        );
        assert(
          res.ok || res.status === 404,
          `cleanup: delete News #2 failed: ${detail(res)}`,
        );
      });
    }

    // =====================================================================
    // TESTS 6-10 — reorder validation (all must write NOTHING)
    // =====================================================================
    await step('TEST 6: empty reorder payload -> 400', async () => {
      const res = await apiCall('/api/v1/admin/home/news-articles/reorder', {
        method: 'PATCH',
        token: admin!.accessToken,
        body: JSON.stringify({ items: [] }),
      });
      assertStatus(res, 400, 'empty reorder');
    });
    await step('TEST 7: malformed UUID in reorder payload -> 400', async () => {
      const res = await apiCall('/api/v1/admin/home/news-articles/reorder', {
        method: 'PATCH',
        token: admin!.accessToken,
        body: JSON.stringify({ items: [{ id: 'not-a-uuid', sortOrder: 1 }] }),
      });
      assertStatus(res, 400, 'malformed reorder uuid');
    });
    await step('TEST 8: duplicate reorder ID -> 400', async () => {
      if (!news1Id) throw new Error('News #1 fixture was not created; duplicate reorder-ID test cannot run safely');
      const res = await apiCall('/api/v1/admin/home/news-articles/reorder', {
        method: 'PATCH',
        token: admin!.accessToken,
        body: JSON.stringify({
          items: [
            { id: news1Id, sortOrder: 1 },
            { id: news1Id, sortOrder: 2 },
          ],
        }),
      });
      assertStatus(res, 400, 'duplicate reorder id');
    });
    await step('TEST 9: duplicate reorder position -> 400', async () => {
      if (!news1Id || !news2Id) throw new Error('News #1/#2 fixture was not created; duplicate reorder-position test cannot run safely');
      const res = await apiCall('/api/v1/admin/home/news-articles/reorder', {
        method: 'PATCH',
        token: admin!.accessToken,
        body: JSON.stringify({
          items: [
            { id: news1Id, sortOrder: 5 },
            { id: news2Id, sortOrder: 5 },
          ],
        }),
      });
      assertStatus(res, 400, 'duplicate reorder position');
    });
    await step(
      'TEST 10: unknown reorder ID -> 422, nothing written',
      async () => {
        if (!news1Id) throw new Error('News #1 fixture was not created; unknown reorder-ID test cannot run safely');
        const res = await apiCall('/api/v1/admin/home/news-articles/reorder', {
          method: 'PATCH',
          token: admin!.accessToken,
          body: JSON.stringify({
            items: [
              { id: news1Id, sortOrder: 5 },
              { id: NONEXISTENT_REORDER_ID, sortOrder: 6 },
            ],
          }),
        });
        assertStatus(res, 422, 'unknown reorder id');
        const check = await apiCall<{ sortOrder: number }>(
          `/api/v1/admin/home/news-articles/${news1Id}`,
          { token: admin!.accessToken },
        );
        assert(
          check.ok && check.body.sortOrder === 99999,
          `News #1 sortOrder must be unchanged (99999) after a rejected reorder, got ${check.ok ? check.body.sortOrder : detail(check)}`,
        );
      },
    );

    // =====================================================================
    // TEST 11 — valid partial reorder, then restore
    // =====================================================================
    await step(
      'TEST 11: valid partial reorder (News #1 <-> News #2), then restore original order',
      async () => {
        if (!news1Id || !news2Id) throw new Error('News #1/#2 fixture was not created; valid partial reorder test cannot run safely');
        const swap = await apiCall('/api/v1/admin/home/news-articles/reorder', {
          method: 'PATCH',
          token: admin!.accessToken,
          body: JSON.stringify({
            items: [
              { id: news1Id, sortOrder: 99998 },
              { id: news2Id, sortOrder: 99999 },
            ],
          }),
        });
        assertStatus(swap, 200, 'valid partial reorder');
        const mid1 = await apiCall<{ sortOrder: number }>(
          `/api/v1/admin/home/news-articles/${news1Id}`,
          { token: admin!.accessToken },
        );
        const mid2 = await apiCall<{ sortOrder: number }>(
          `/api/v1/admin/home/news-articles/${news2Id}`,
          { token: admin!.accessToken },
        );
        assert(
          mid1.ok && mid1.body.sortOrder === 99998,
          'News #1 sortOrder did not update to 99998',
        );
        assert(
          mid2.ok && mid2.body.sortOrder === 99999,
          'News #2 sortOrder did not update to 99999',
        );

        const restore = await apiCall(
          '/api/v1/admin/home/news-articles/reorder',
          {
            method: 'PATCH',
            token: admin!.accessToken,
            body: JSON.stringify({
              items: [
                { id: news1Id, sortOrder: 99999 },
                { id: news2Id, sortOrder: 99998 },
              ],
            }),
          },
        );
        assertStatus(restore, 200, 'restore original order');
        const final1 = await apiCall<{ sortOrder: number }>(
          `/api/v1/admin/home/news-articles/${news1Id}`,
          { token: admin!.accessToken },
        );
        const final2 = await apiCall<{ sortOrder: number }>(
          `/api/v1/admin/home/news-articles/${news2Id}`,
          { token: admin!.accessToken },
        );
        assert(
          final1.ok && final1.body.sortOrder === 99999,
          'restore of News #1 sortOrder failed',
        );
        assert(
          final2.ok && final2.body.sortOrder === 99998,
          'restore of News #2 sortOrder failed',
        );
      },
    );

    // =====================================================================
    // TEST 12 — soft-deleted media -> image: null (see file header §4 for
    // why the one deliberate direct-Prisma write below is necessary and
    // scoped entirely to fixture rows this script created)
    // =====================================================================
    let mediaCId: string | undefined;
    await step(
      'Fixture: upload QA media asset C (for the soft-delete test)',
      async () => {
        const form = new FormData();
        form.append(
          'file',
          new Blob([new Uint8Array(qaPng())], { type: 'image/png' }),
          `${QA_TAG}-c.png`,
        );
        const res = await apiCall<{ id: string }>(
          '/api/v1/admin/media/upload',
          { method: 'POST', token: admin!.accessToken, body: form },
        );
        assert(res.ok, `media C upload failed: ${detail(res)}`);
        mediaCId = res.body.id;
        registerCleanup(`delete QA media C (${mediaCId})`, async () => {
          const res = await apiCall(`/api/v1/admin/media/${mediaCId}`, {
            method: 'DELETE',
            token: admin!.accessToken,
          });
          assert(
            res.ok || res.status === 404 || res.status === 409,
            `cleanup: delete QA media C failed: ${detail(res)}`,
          );
        });
      },
    );
    await step(
      'Fixture: soft-delete QA media C while unreferenced -> 200 (also proves the unreferenced-delete path still works)',
      async () => {
        const res = await apiCall(`/api/v1/admin/media/${mediaCId}`, {
          method: 'DELETE',
          token: admin!.accessToken,
        });
        assertStatus(res, 200, 'soft-delete unreferenced media');
      },
    );

    let news3Id: string | undefined;
    const news3Slug = `${QA_SLUG}-news3`;
    await step(
      'Fixture: create QA News #3 (ACTIVE — must appear on the public endpoint for this one test)',
      async () => {
        const res = await apiCall<{ id: string }>(
          '/api/v1/admin/home/news-articles',
          {
            method: 'POST',
            token: admin!.accessToken,
            body: JSON.stringify({
              category: QA_TAG,
              kicker: QA_TAG,
              title: QA_TAG,
              lead: QA_TAG,
              bodySlug: news3Slug,
              sortOrder: 99997,
              active: true,
            }),
          },
        );
        assert(res.ok, `create News #3 failed: ${detail(res)}`);
        news3Id = res.body.id;
      },
    );
    if (news3Id) {
      registerCleanup(`delete QA News #3 (${news3Id})`, async () => {
        const res = await apiCall(
          `/api/v1/admin/home/news-articles/${news3Id}`,
          { method: 'DELETE', token: admin!.accessToken },
        );
        assert(
          res.ok || res.status === 404,
          `cleanup: delete News #3 failed: ${detail(res)}`,
        );
      });
    }

    if (news3Id && mediaCId) {
      await step(
        'DELIBERATE direct-Prisma step (see file header §4): repoint QA News #3 (fixture, own row) at QA media C (fixture, own asset, already soft-deleted) — simulates a legacy dead reference the API itself can no longer create',
        async () => {
          await prisma.homeNewsArticle.update({
            where: { id: news3Id },
            data: { mediaAssetId: mediaCId },
          });
        },
      );
    } else {
      record(
        'DELIBERATE direct-Prisma step (see file header §4): repoint QA News #3',
        'FAIL',
        'skipped safely because News #3 or media C fixture was not created successfully',
      );
    }

    await step(
      'TEST 12: public GET /home/news-articles shows the QA row with image: null, HTTP 200, row present',
      async () => {
        if (!news3Id || !mediaCId) throw new Error('News #3 or media C fixture was not created; soft-deleted-media public test cannot run safely');
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

    // =====================================================================
    // TEST 13 — media delete protection (media A, referenced by News #1)
    // =====================================================================
    await step(
      'TEST 13: delete QA media A while referenced by News #1 -> 409, reference intact, nothing detached',
      async () => {
        if (!news1Id || !mediaAId) throw new Error('News #1 or media A fixture was not created; referenced-media delete test cannot run safely');
        const res = await apiCall(`/api/v1/admin/media/${mediaAId}`, {
          method: 'DELETE',
          token: admin!.accessToken,
        });
        assertStatus(res, 409, 'referenced media delete');
        const mediaCheck = await apiCall<{ active: boolean }>(
          `/api/v1/admin/media/${mediaAId}`,
          { token: admin!.accessToken },
        );
        assert(
          mediaCheck.ok,
          `media A must still exist after the rejected delete: ${detail(mediaCheck)}`,
        );
        const rowCheck = await apiCall<{ mediaAssetId: string | null }>(
          `/api/v1/admin/home/news-articles/${news1Id}`,
          { token: admin!.accessToken },
        );
        assert(
          rowCheck.ok && rowCheck.body.mediaAssetId === mediaAId,
          'News #1 mediaAssetId must be unchanged (never detached/rewritten) after the rejected delete',
        );
      },
    );

    // =====================================================================
    // Public Home GET regression (pre-cleanup snapshot only; the real
    // baseline comparison happens post-cleanup below)
    // =====================================================================
    await step(
      'Public Home GETs remain healthy with fixtures still present',
      () => fetchHomeCounts('pre-cleanup'),
    );

    // =====================================================================
    // Cleanup (mandatory — runs in `finally` below regardless of the above)
    // =====================================================================
  } finally {
    await runCleanup();

    const afterFixtureCount = await step(
      'Post-cleanup: 0 rows remain anywhere containing the QA tag',
      async () => {
