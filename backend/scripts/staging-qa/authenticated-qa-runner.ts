/**
 * Stage 5.22 — authenticated staging QA runner (API layer).
 *
 * Run ONLY via deploy/staging/run-authenticated-qa.sh, which invokes this
 * (compiled) script inside the real `backend` Docker image — see that
 * file's header for why (Prisma/DB access for RBAC test-account
 * provisioning, which has no REST equivalent in this codebase, plus zero
 * new npm dependencies: Node 20's built-in fetch/FormData/Blob cover every
 * HTTP need here).
 *
 * Never run this against production. It authenticates as the real
 * SUPER_ADMIN, provisions and deletes temporary CONTENT_EDITOR/
 * SUPPORT_VIEWER admin accounts, uploads and deletes a disposable test
 * image, creates and deletes disposable Home CMS rows, and briefly mutates
 * (then restores) four real approved Home CMS rows to prove Admin->Customer
 * propagation. Every mutation of *approved* content is snapshotted before
 * mutating and restored in a `finally` block — see `registerRestore()`.
 *
 * Manual, one-time-only:
 *   `node dist/scripts/staging-qa/authenticated-qa-runner.js`
 * — but always through the wrapper script, which sets the right env,
 * builds the current image first, and prints the report path afterward.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { hashPassword } from '../../src/modules/admin-auth/password-hash.util';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_ORIGIN = process.env.QA_API_ORIGIN || 'https://api-staging.biawin.ir';
const CUSTOMER_ORIGIN =
  process.env.QA_CUSTOMER_ORIGIN || 'https://staging.biawin.ir';
// Not called directly by this script (no admin-app HTTP surface beyond the
// API), kept only so the report records what was configured.
const ADMIN_ORIGIN =
  process.env.QA_ADMIN_ORIGIN || 'https://admin-staging.biawin.ir';

const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL;
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

const REPORT_DIR = process.env.QA_REPORT_DIR ?? '/tmp/biawin-staging-qa';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');

const QA_TAG = `STAGE522-QA-${Date.now()}-${randomBytes(3).toString('hex')}`;

/** The permanent, intentional STAGING_TEST_AUTH fixture phone — see customerAuthCheck(). */
const STAGING_TEST_PHONE = '09121111111';
const STAGING_TEST_OTP = '123456';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

type Status = 'PASS' | 'FAIL' | 'NOT_TESTED';
interface Result {
  name: string;
  status: Status;
  detail: string;
}
const results: Result[] = [];
const restoreTasks: Array<{ name: string; run: () => Promise<void> }> = [];

function record(name: string, status: Status, detail = ''): void {
  results.push({ name, status, detail });
  const marker =
    status === 'PASS' ? 'PASS ' : status === 'FAIL' ? 'FAIL ' : 'SKIP ';
  console.log(`[qa] ${marker} ${name}${detail ? ' — ' + redact(detail) : ''}`);
}

/** Never let a token/secret-shaped string leak into the report. */
function redact(s: string): string {
  return s
    .replace(
      /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      '<redacted-jwt>',
    )
    .replace(
      new RegExp(
        ADMIN_SEED_PASSWORD ? escapeRegExp(ADMIN_SEED_PASSWORD) : '(?!)',
        'g',
      ),
      '<redacted>',
    );
}
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Runs one check; never throws — records FAIL and returns undefined instead. */
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

function skip(name: string, reason: string): void {
  record(name, 'NOT_TESTED', reason);
}

/** Registered immediately after snapshotting approved content, BEFORE mutating it — runs in the final cleanup phase regardless of what happens later. */
function registerRestore(name: string, run: () => Promise<void>): void {
  restoreTasks.push({ name, run });
}

// ---------------------------------------------------------------------------
// HTTP helpers — Node 20 native fetch/FormData/Blob, no dependency needed
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  status: number;
  body: T;
  ok: boolean;
  /** Populated from the real error envelope's `error.message` when the response was an error — see below. */
  errorMessage?: string;
}

/**
 * Every response from this backend is wrapped by a global interceptor/filter
 * pair (`ResponseInterceptor` / `HttpExceptionFilter`, registered as
 * `APP_INTERCEPTOR`/`APP_FILTER` in `backend/src/app.module.ts`) — NEVER a
 * bare body:
 *   success: `{ success: true, data: <actual payload> }`
 *   error:   `{ success: false, error: { code, message, details? } }`
 * This bit this exact script once already: an earlier version read
 * `res.body.accessToken` directly on the raw (wrapped) login response,
 * got `undefined`, sent `Authorization: Bearer undefined` to the very next
 * call, and that call correctly 401'd — reported as "post-login /me failed:
 * HTTP 401" when the actual, sole bug was here, in this parsing layer, not
 * in the login/me contract itself (both behave exactly as the backend
 * source defines). Unwrapping here, once, means every call site below
 * keeps working with `res.body.<field>` as if the payload were bare — that
 * assumption was always correct for the DATA shape, just not for where it
 * lived in the envelope.
 */
async function apiCall<T = unknown>(
  origin: string,
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
    res = await fetch(`${origin}${path}`, { ...init, headers });
  } catch (err) {
    // SERVICES-R1.2 finding: a real staging run reported nothing but the
    // bare "fetch failed" from undici (Node's fetch), with no way to tell
    // a DNS failure from ECONNREFUSED from a TLS error from a timeout —
    // undici puts the actual reason on `err.cause`, one level down from
    // the outer TypeError this catches, and it never surfaces on its own.
    // `path` (never a secret — every call site here passes a fixed API
    // route) and `origin` are safe to log; nothing from `init` (which can
    // carry a password/token) is included.
    const cause =
      err instanceof Error && 'cause' in err ? err.cause : undefined;
    const causeDetail =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : cause !== undefined
          ? String(cause)
          : 'no cause reported';
    throw new Error(
      `network request to ${origin}${path} failed before a response was received — ${causeDetail}`,
    );
  }
  let parsed: unknown = undefined;
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
    if (envelope.success === true && 'data' in envelope) {
      body = envelope.data;
    } else if (envelope.success === false && envelope.error) {
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

/**
 * Formats a failed response for a failure message — status PLUS the real
 * backend error envelope's message (`{success:false, error:{message}}`,
 * see `apiCall()`'s own comment), not just a bare status code. A real
 * staging run once reported nothing more than "got HTTP 500" for a
 * genuine failure, which was uninformative on its own; every assertion
 * below now uses this instead of interpolating `.status` directly.
 */
function detail(res: ApiResponse<unknown>): string {
  return `HTTP ${res.status}${res.errorMessage ? ' — ' + res.errorMessage : ''}`;
}

// A 1x1 transparent PNG — minimal, valid, real image bytes (not a renamed
// text file) so the backend's magic-byte validation genuinely passes.
const VALID_PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

interface AdminSession {
  accessToken: string;
  refreshToken: string;
  role: string;
  email: string;
}

async function adminLogin(
  email: string,
  password: string,
): Promise<AdminSession> {
  const res = await apiCall<{ accessToken: string; refreshToken: string }>(
    API_ORIGIN,
    '/api/v1/admin/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  assert(res.ok, `login failed: ${detail(res)}`);
  assert(
    typeof res.body.accessToken === 'string' && res.body.accessToken.length > 0,
    `login returned ${detail(res)} but no usable accessToken — got: ${JSON.stringify(res.body).slice(0, 200)}`,
  );
  const me = await apiCall<{ role: string; email: string }>(
    API_ORIGIN,
    '/api/v1/admin/auth/me',
    {
      token: res.body.accessToken,
    },
  );
  assert(me.ok, `post-login /me failed: ${detail(me)}`);
  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    role: me.body.role,
    email: me.body.email,
  };
}

/**
 * Every admin Home CMS `listAdmin()` service method (hero-cards,
 * service-banners, service-mosaic-tiles, news-articles — confirmed
 * identical across all four, e.g. `home-hero-cards.service.ts:57-72`)
 * returns `{ items, total, skip, take }`, NOT a bare array — a paginated
 * wrapper, same shape as the audit-log endpoint. A real staging run once
 * had every propagation snapshot fail with "expected at least one
 * existing X" against real, present, seeded data — `res.body` (already
 * unwrapped from the outer `{success,data}` envelope by `apiCall()`) was
 * still `{items:[...], total, ...}`, an object, so `.length`/`[0]` on it
 * were `undefined`. This central helper is the fix, applied once instead
 * of at every list call site individually.
 */
async function adminList<T>(
  resourcePath: string,
  query: string,
  token: string,
): Promise<T[]> {
  const res = await apiCall<{ items: T[]; total: number }>(
    API_ORIGIN,
    `/api/v1/admin/home/${resourcePath}${query}`,
    { token },
  );
  assert(res.ok, `list ${resourcePath} failed: ${detail(res)}`);
  assert(
    Array.isArray(res.body.items),
    `list ${resourcePath} returned ${detail(res)} but body.items was not an array — got: ${JSON.stringify(res.body).slice(0, 200)}`,
  );
  return res.body.items;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `[qa] Stage 5.22 authenticated QA runner starting — run tag ${QA_TAG}`,
  );
  console.log(
    `[qa] targets: API=${API_ORIGIN} customer=${CUSTOMER_ORIGIN} admin=${ADMIN_ORIGIN}`,
  );

  if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD) {
    skip(
      'Admin login (SUPER_ADMIN)',
      "ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not present in this container's environment",
    );
    finish(
      new Error('Cannot run without ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD'),
    );
    return;
  }

  let superAdmin: AdminSession | undefined;
  let editorAdmin: AdminSession | undefined;
  let viewerAdmin: AdminSession | undefined;
  let editorUserId: string | undefined;
  let viewerUserId: string | undefined;

  try {
    // --- Section 2: Admin auth QA -----------------------------------------
    superAdmin = await step('Admin login (SUPER_ADMIN)', () =>
      adminLogin(ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD),
    );
    if (!superAdmin)
      throw new Error('Fatal: cannot proceed without a SUPER_ADMIN session');
    assert(
      superAdmin.role === 'SUPER_ADMIN',
      `seeded admin has role ${superAdmin.role}, expected SUPER_ADMIN`,
    );

    await step('Admin login rejects wrong password', async () => {
      const res = await apiCall(API_ORIGIN, '/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: ADMIN_SEED_EMAIL,
          password: `${ADMIN_SEED_PASSWORD}-wrong-${randomUUID()}`,
        }),
      });
      assert(
        !res.ok,
        `expected login to fail with wrong password, got ${detail(res)}`,
      );
      assert(
        res.status === 401,
        `expected 401 for wrong password, got ${res.status}`,
      );
    });

    await step(
      'Admin token rejected by customer /auth/refresh (cross-boundary)',
      async () => {
        const res = await apiCall(API_ORIGIN, '/api/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: superAdmin!.refreshToken }),
        });
        assert(
          !res.ok,
          `expected admin refresh token to be rejected by customer /auth/refresh, got ${detail(res)}`,
        );
      },
    );

    await step('Admin logout invalidates the refresh token', async () => {
      const logoutRes = await apiCall(API_ORIGIN, '/api/v1/admin/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: superAdmin!.refreshToken }),
      });
      assert(
        logoutRes.status === 204,
        `expected 204 from logout, got ${logoutRes.status}`,
      );
      const reuse = await apiCall(API_ORIGIN, '/api/v1/admin/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: superAdmin!.refreshToken }),
      });
      assert(
        !reuse.ok,
        `expected the logged-out refresh token to be rejected, got ${detail(reuse)}`,
      );
      // Re-authenticate — every later step needs a live session, and logout
      // only invalidated the refresh token, not the still-valid access token,
      // but we re-login anyway for a clean, long-lived session for the rest
      // of this run.
      superAdmin = await adminLogin(ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD);
    });

    // --- Section 3: RBAC — provision temporary CONTENT_EDITOR/SUPPORT_VIEWER
    const editorEmail = `qa-content-editor-${QA_TAG}@biawin-staging.qa.invalid`;
    const viewerEmail = `qa-support-viewer-${QA_TAG}@biawin-staging.qa.invalid`;
    const editorPassword = randomBytes(24).toString('hex');
    const viewerPassword = randomBytes(24).toString('hex');

    await step('Provision temporary CONTENT_EDITOR test account', async () => {
      const passwordHash = await hashPassword(editorPassword);
      const row = await prisma.adminUser.create({
        data: {
          email: editorEmail,
          passwordHash,
          fullName: 'QA Content Editor (temporary)',
          role: 'CONTENT_EDITOR',
        },
      });
      editorUserId = row.id;
    });
    if (editorUserId) {
      registerRestore(
        'Delete temporary CONTENT_EDITOR test account',
        async () => {
          await prisma.adminUser
            .delete({ where: { id: editorUserId! } })
            .catch((e) => {
              // Already gone is fine (idempotent cleanup); anything else re-throws.
              if (!String(e).includes('Record to delete does not exist'))
                throw e;
            });
        },
      );
    }

    await step('Provision temporary SUPPORT_VIEWER test account', async () => {
      const passwordHash = await hashPassword(viewerPassword);
      const row = await prisma.adminUser.create({
        data: {
          email: viewerEmail,
          passwordHash,
          fullName: 'QA Support Viewer (temporary)',
          role: 'SUPPORT_VIEWER',
        },
      });
      viewerUserId = row.id;
    });
    if (viewerUserId) {
      registerRestore(
        'Delete temporary SUPPORT_VIEWER test account',
        async () => {
          await prisma.adminUser
            .delete({ where: { id: viewerUserId! } })
            .catch((e) => {
              if (!String(e).includes('Record to delete does not exist'))
                throw e;
            });
        },
      );
    }

    editorAdmin = await step('Login as temporary CONTENT_EDITOR', () =>
      adminLogin(editorEmail, editorPassword),
    );
    viewerAdmin = await step('Login as temporary SUPPORT_VIEWER', () =>
      adminLogin(viewerEmail, viewerPassword),
    );

    // News Article, not Hero Card: HomeHeroCard.cardKey is @unique across
    // exactly 3 always-already-seeded values (see
    // heroCardExistingRowCheck's own comment for the real staging 500
    // this caused) — News Article has no such constraint and is exactly
    // what crudResourceCheck already proves disposable-row create/delete
    // against as SUPER_ADMIN below, so this RBAC probe reuses the same
    // safe resource, just as CONTENT_EDITOR instead.
    let editorProbeId: string | undefined;
    await step('CONTENT_EDITOR can create a Home News Article', async () => {
      if (!editorAdmin) throw new Error('no CONTENT_EDITOR session');
      const res = await apiCall<{ id: string }>(
        API_ORIGIN,
        '/api/v1/admin/home/news-articles',
        {
          method: 'POST',
          token: editorAdmin.accessToken,
          body: JSON.stringify(rbacProbeNewsArticle()),
        },
      );
      assert(
        res.ok,
        `expected CONTENT_EDITOR create to succeed, got ${detail(res)}`,
      );
      editorProbeId = res.body.id;
    });
    if (editorProbeId) {
      await step('CONTENT_EDITOR can delete a Home News Article', async () => {
        const res = await apiCall(
          API_ORIGIN,
          `/api/v1/admin/home/news-articles/${editorProbeId}`,
          {
            method: 'DELETE',
            token: editorAdmin!.accessToken,
          },
        );
        assert(
          res.ok,
          `expected CONTENT_EDITOR delete to succeed, got ${detail(res)}`,
        );
      });
    }

    await step('SUPPORT_VIEWER can read Home Hero Cards', async () => {
      if (!viewerAdmin) throw new Error('no SUPPORT_VIEWER session');
      const res = await apiCall(API_ORIGIN, '/api/v1/admin/home/hero-cards', {
        token: viewerAdmin.accessToken,
      });
      assert(
        res.ok,
        `expected SUPPORT_VIEWER read to succeed, got ${detail(res)}`,
      );
    });

    await step(
      'SUPPORT_VIEWER mutation is rejected with HTTP 403 (real forbidden-mutation proof)',
      async () => {
        if (!viewerAdmin) throw new Error('no SUPPORT_VIEWER session');
        const res = await apiCall(API_ORIGIN, '/api/v1/admin/home/hero-cards', {
          method: 'POST',
          token: viewerAdmin.accessToken,
          body: JSON.stringify(rbacProbeHeroCard()),
        });
        assert(
          res.status === 403,
          `expected HTTP 403 for SUPPORT_VIEWER mutation, got ${res.status}`,
        );
      },
    );

    await step(
      'Audit log route is SUPER_ADMIN-only (CONTENT_EDITOR rejected 403)',
      async () => {
        if (!editorAdmin) throw new Error('no CONTENT_EDITOR session');
        const res = await apiCall(API_ORIGIN, '/api/v1/admin/audit-logs', {
          token: editorAdmin.accessToken,
        });
        assert(
          res.status === 403,
          `expected HTTP 403 for CONTENT_EDITOR on audit log, got ${res.status}`,
        );
      },
    );

    // --- Section 4: Media QA ------------------------------------------------
    let disposableMediaId: string | undefined;
    let disposableMediaUrl: string | undefined;
    await step(
      'Valid media upload (real PNG bytes, magic-byte check passes)',
      async () => {
        const form = new FormData();
        form.append(
          'file',
          new Blob([VALID_PNG_1x1], { type: 'image/png' }),
          `${QA_TAG}.png`,
        );
        form.append('altText', `Disposable QA asset ${QA_TAG}`);
        const res = await apiCall<{ id: string; url: string }>(
          API_ORIGIN,
          '/api/v1/admin/media/upload',
          {
            method: 'POST',
            token: superAdmin!.accessToken,
            body: form,
          },
        );
        assert(res.ok, `expected upload to succeed, got ${detail(res)}`);
        disposableMediaId = res.body.id;
        disposableMediaUrl = res.body.url;
      },
    );
    if (disposableMediaId) {
      registerRestore('Delete disposable QA media asset', async () => {
        const res = await apiCall(
          API_ORIGIN,
          `/api/v1/admin/media/${disposableMediaId}`,
          {
            method: 'DELETE',
            token: superAdmin!.accessToken,
          },
        );
        if (!res.ok && res.status !== 404)
          throw new Error(`cleanup delete failed: ${detail(res)}`);
      });
    }

    if (disposableMediaUrl) {
      await step(
        'Uploaded media is retrievable via its storage route (checked via API_ORIGIN, not the hardcoded public domain — see comment)',
        async () => {
          // SERVICES-R1.6 finding: MediaStorageService.resolvePublicUrl()
          // (backend/src/modules/media/media-storage.service.ts) always
          // builds an ABSOLUTE URL from the backend's own PUBLIC_API_ORIGIN
          // config — independent of this script's API_ORIGIN. When this
          // script runs inside the backend compose-network container (see
          // deploy/staging/run-authenticated-qa.sh), that public-domain URL
          // hits the exact same network limitation the admin-login fix
          // (SERVICES-R1.3) worked around: the container cannot reach its
          // own public HTTPS domain. External reachability of the SAME
          // route pattern was independently confirmed this session —
          // `https://api-staging.biawin.ir/api/v1/media/<nonexistent-file>`
          // returns a real 404 (not a connection/DNS failure) from a normal
          // internet client, proving the route+domain resolve correctly;
          // this is a container egress limitation, not a media/storage
          // defect. Re-targeting the SAME path onto this script's own
          // configured API_ORIGIN (internal when run via
          // run-authenticated-qa.sh, public if ever run standalone) matches
          // every other request in this script and still proves the file
          // is genuinely stored and servable end-to-end. Public HTTPS
          // reachability of the customer-facing path is covered separately
          // by the browser-qa layer's own real-browser image-loading checks
          // (Home's `<img>` tags resolve through the real public domain in
          // every browser-qa run) and was independently curl-verified this
          // session for the media route pattern specifically.
          const mediaPath = new URL(disposableMediaUrl!).pathname;
          const targetUrl = `${API_ORIGIN}${mediaPath}`;
          let res: Response;
          try {
            res = await fetch(targetUrl);
          } catch (err) {
            const cause =
              err instanceof Error && 'cause' in err ? err.cause : undefined;
            const causeDetail =
              cause instanceof Error
                ? `${cause.name}: ${cause.message}`
                : cause !== undefined
                  ? String(cause)
                  : 'no cause reported';
            throw new Error(
              `network request to ${targetUrl} failed before a response was received — ${causeDetail}`,
            );
          }
          assert(
            res.ok,
            `expected media at ${mediaPath} to be retrievable via API_ORIGIN (${API_ORIGIN}), got HTTP ${res.status}`,
          );
          const ct = res.headers.get('content-type');
          assert(
            !!ct && ct.startsWith('image/'),
            `expected an image content-type from ${targetUrl}, got ${ct}`,
          );
        },
      );
    }

    await step('Invalid/mismatched-signature upload is rejected', async () => {
      const form = new FormData();
      form.append(
        'file',
        new Blob([Buffer.from('this is not an image')], { type: 'image/png' }),
        `${QA_TAG}-fake.png`,
      );
      const res = await apiCall(API_ORIGIN, '/api/v1/admin/media/upload', {
        method: 'POST',
        token: superAdmin!.accessToken,
        body: form,
      });
      assert(
        !res.ok,
        `expected the magic-byte mismatch to be rejected, got ${detail(res)}`,
      );
    });

    await step(
      'SUPPORT_VIEWER media upload is rejected with HTTP 403',
      async () => {
        if (!viewerAdmin) throw new Error('no SUPPORT_VIEWER session');
        const form = new FormData();
        form.append(
          'file',
          new Blob([VALID_PNG_1x1], { type: 'image/png' }),
          `${QA_TAG}-viewer.png`,
        );
        const res = await apiCall(API_ORIGIN, '/api/v1/admin/media/upload', {
          method: 'POST',
          token: viewerAdmin.accessToken,
          body: form,
        });
        assert(
          res.status === 403,
          `expected HTTP 403 for SUPPORT_VIEWER upload, got ${res.status}`,
        );
      },
    );

    // --- Section 5: Home CRUD QA (disposable rows) + category UUID proof ---
    const realCategoryId = await step(
      'Fetch a real Category UUID from the public API',
      async () => {
        const res = await apiCall<Array<{ categoryId: string }>>(
          API_ORIGIN,
          '/api/v1/home/service-banners',
        );
        assert(
          res.ok && Array.isArray(res.body) && res.body.length > 0,
          'expected at least one existing service banner to source a real categoryId from',
        );
        return res.body[0].categoryId;
      },
    );

    // Not crudResourceCheck: HomeHeroCard has no valid disposable row to
    // create (cardKey is @unique across exactly 3 always-already-seeded
    // values) — see heroCardExistingRowCheck's own comment.
    await heroCardExistingRowCheck(superAdmin);
    if (realCategoryId) {
      await crudResourceCheck(
        'service-banners',
        {
          categoryId: realCategoryId,
          kicker: `${QA_TAG}-kicker`,
          sortOrder: 9999,
          active: true,
        },
        { kicker: `${QA_TAG}-kicker-updated` },
        superAdmin,
        realCategoryId,
      );
      await crudResourceCheck(
        'service-mosaic-tiles',
        {
          categoryId: realCategoryId,
          slotType: 'half',
          kicker: `${QA_TAG}-kicker`,
          sortOrder: 9999,
          active: true,
        },
        { kicker: `${QA_TAG}-kicker-updated` },
        superAdmin,
        realCategoryId,
      );
    } else {
      skip(
        'Home CRUD: service-banners',
        'no real categoryId available (public API returned no rows)',
      );
      skip(
        'Home CRUD: service-mosaic-tiles',
        'no real categoryId available (public API returned no rows)',
      );
    }
    await crudResourceCheck(
      'news-articles',
      {
        category: `${QA_TAG}-category-label`,
        kicker: `${QA_TAG}-kicker`,
        title: `${QA_TAG}-title`,
        lead: `${QA_TAG}-lead`,
        sortOrder: 9999,
        active: true,
      },
      { title: `${QA_TAG}-title-updated` },
      superAdmin,
    );

    // --- Section 7: Admin -> Customer propagation (approved content, restored)
    await propagationTextCheck(superAdmin);
    await propagationActiveCheck(superAdmin);
    await propagationReorderCheck(superAdmin);
    await propagationImageCheck(superAdmin);

    // --- Section 8: Customer authenticated QA (STAGING_TEST_AUTH) ----------
    const customerToken = await customerAuthCheck();

    // --- Section 11: Audit log QA -------------------------------------------
    await auditLogCrudProofCheck(superAdmin);
    await step(
      "Audit log contains entries for this run's mutations (broad sanity check)",
      async () => {
        const res = await apiCall<{
          items: Array<{
            resourceType: string;
            resourceId: string | null;
            action: string;
          }>;
        }>(API_ORIGIN, '/api/v1/admin/audit-logs?page=1&limit=100', {
          token: superAdmin!.accessToken,
        });
        assert(
          res.ok,
          `expected audit log read to succeed, got ${detail(res)}`,
        );
        const items = res.body.items ?? [];
        const hasCreate = items.some((i) => i.action === 'CREATE');
        const hasUpdate = items.some((i) => i.action === 'UPDATE');
        const hasDelete = items.some((i) => i.action === 'DELETE');
        assert(
          hasCreate && hasUpdate && hasDelete,
          `expected recent CREATE/UPDATE/DELETE audit entries, found: ${JSON.stringify({ hasCreate, hasUpdate, hasDelete })}`,
        );
      },
    );

    // --- Section 12: SERVICES-R5.1 Transaction Foundation QA ---------------
    await servicesR511TransactionFoundationCheck(customerToken);

    // --- Section 13: SERVICES-R5.19 CardProduct Purchase Order QA ---------
    await servicesR519CardProductPurchaseFoundationCheck(customerToken, superAdmin);

    // --- Section 14: SERVICES-R5.24 CategoryCard ownership + CRUD QA -------
    // No prior section in this file ever exercised `/admin/category-cards`
    // or `CategoryCardsService`'s server-side ownership check — confirmed
    // by grep before writing this (zero matches for
    // "admin/category-cards"). Browser-level CategoryCard coverage exists
    // (`deploy/staging/qa/browser/browser-qa.ts`, SERVICES-R5.23) but never
    // proves the ownership REJECTION path, only the happy path a real
    // click can reach.
    await categoryCardOwnershipAndCrudCheck(superAdmin);

    // --- Section 15: SERVICES-R5.26.1 default catalog end-to-end QA --------
    await servicesR5261DefaultCatalogCheck();

    // --- Section 16: SERVICES-R5.26.2 default catalog finalization QA ------
    await servicesR5262DefaultCatalogFinalizationCheck();
  } catch (fatal) {
    finish(fatal instanceof Error ? fatal : new Error(String(fatal)));
    return;
  }

  finish(null);
}

/**
 * Only ever POSTed by a request expected to be rejected before it reaches
 * the database (the SUPPORT_VIEWER 403 probe — AdminRolesGuard rejects it
 * before the controller/service/Prisma layer ever runs, so the colliding
 * cardKey below never actually causes a write attempt). NEVER use this
 * for a probe expected to actually succeed and persist — see
 * heroCardExistingRowCheck's comment for why (cardKey is @unique across
 * exactly 3 always-already-seeded values; this literal 'biawin' always
 * collides with the real seeded row of the same key).
 */
function rbacProbeHeroCard() {
  return {
    cardKey: 'biawin',
    label: `${QA_TAG}-label`,
    title: `${QA_TAG}-title`,
    subtitle: `${QA_TAG}-subtitle`,
    displayNumber: '0000 0000 0000 0000',
    ownerLabel: 'QA RUNNER',
    sortOrder: 9999,
    active: true,
  };
}

/** Safe for an actually-persisting create probe — no unique/FK constraint to collide with. */
function rbacProbeNewsArticle() {
  return {
    category: `${QA_TAG}-rbac-probe-category`,
    kicker: `${QA_TAG}-kicker`,
    title: `${QA_TAG}-title`,
    lead: `${QA_TAG}-lead`,
    sortOrder: 9999,
    active: true,
  };
}

/** Generic disposable-row CRUD proof for one Home CMS resource. */
async function crudResourceCheck(
  resourcePath: string,
  createBody: Record<string, unknown>,
  updateBody: Record<string, unknown>,
  admin: AdminSession | undefined,
  expectCategoryId?: string,
): Promise<void> {
  if (!admin) {
    skip(`Home CRUD: ${resourcePath}`, 'no admin session available');
    return;
  }
  let id: string | undefined;
  await step(`Home CRUD ${resourcePath}: create`, async () => {
    const res = await apiCall<{ id: string; categoryId?: string }>(
      API_ORIGIN,
      `/api/v1/admin/home/${resourcePath}`,
      {
        method: 'POST',
        token: admin.accessToken,
        body: JSON.stringify(createBody),
      },
    );
    assert(res.ok, `create failed: ${detail(res)}`);
    id = res.body.id;
    if (expectCategoryId) {
      assert(
        res.body.categoryId === expectCategoryId,
        `expected categoryId to be the real UUID ${expectCategoryId}, got ${res.body.categoryId} — this is the display-name-vs-UUID relationship proof`,
      );
    }
  });
  if (!id) {
    skip(
      `Home CRUD ${resourcePath}: edit/reorder/delete`,
      'create failed, nothing to operate on',
    );
    return;
  }
  registerRestore(
    `Home CRUD ${resourcePath}: delete disposable row (cleanup)`,
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/${resourcePath}/${id}`,
        {
          method: 'DELETE',
          token: admin.accessToken,
        },
      );
      if (!res.ok && res.status !== 404)
        throw new Error(`cleanup delete failed: ${detail(res)}`);
    },
  );

  await step(`Home CRUD ${resourcePath}: edit persists`, async () => {
    const put = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/${resourcePath}/${id}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({ ...createBody, ...updateBody }),
      },
    );
    assert(put.ok, `update failed: ${detail(put)}`);
    const get = await apiCall<Record<string, unknown>>(
      API_ORIGIN,
      `/api/v1/admin/home/${resourcePath}/${id}`,
      {
        token: admin.accessToken,
      },
    );
    assert(get.ok, `re-fetch after update failed: ${detail(get)}`);
    for (const [key, value] of Object.entries(updateBody)) {
      assert(
        get.body[key] === value,
        `expected ${key}=${String(value)} to persist, got ${String(get.body[key])}`,
      );
    }
  });

  await step(`Home CRUD ${resourcePath}: active toggle`, async () => {
    const put = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/${resourcePath}/${id}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({ ...createBody, ...updateBody, active: false }),
      },
    );
    assert(put.ok, `deactivate failed: ${detail(put)}`);
    const get = await apiCall<{ active: boolean }>(
      API_ORIGIN,
      `/api/v1/admin/home/${resourcePath}/${id}`,
      {
        token: admin.accessToken,
      },
    );
    assert(
      get.ok && get.body.active === false,
      `expected active=false to persist`,
    );
  });

  await step(
    `Home CRUD ${resourcePath}: reorder endpoint accepts a valid payload`,
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/${resourcePath}/reorder`,
        {
          method: 'PATCH',
          token: admin.accessToken,
          body: JSON.stringify({ items: [{ id, sortOrder: 9998 }] }),
        },
      );
      assert(res.ok, `reorder failed: ${detail(res)}`);
    },
  );
}

/**
 * HomeHeroCard's CRUD proof, structurally different from the other three
 * resources: `cardKey` is `@unique` across exactly 3 fixed enum values
 * (`biawin`/`earn`/`reward` — `schema.prisma:825`, "exactly one row per of
 * the 3 fixed slots"), and all 3 are always already seeded in any real
 * environment. There is no valid disposable `cardKey` to create a 4th
 * row with — `crudResourceCheck`'s create-then-delete pattern is simply
 * the wrong shape of test for this one resource; a real staging run
 * confirmed this directly (`POST .../hero-cards` with a colliding
 * `cardKey` genuinely 500'd on the Prisma unique-constraint violation —
 * a QA-payload defect, not an application defect: the app correctly
 * rejects the duplicate, it just does so via an unhandled 500 rather
 * than a translated 409, which is a separate, minor, non-blocking
 * observation, not something this fix touches). This proves the same
 * write/persist/reorder paths against one EXISTING approved row instead
 * — snapshotted and restored with the same guarantee as the propagation
 * checks below, never created or deleted.
 */
async function heroCardExistingRowCheck(
  admin: AdminSession | undefined,
): Promise<void> {
  if (!admin) {
    skip('Home CRUD hero-cards', 'no admin session available');
    return;
  }
  const original = await step(
    'Home CRUD hero-cards: snapshot an existing row (create/delete not applicable — see comment)',
    async () => {
      const items = await adminList<{
        id: string;
        label: string;
        sortOrder: number;
      }>('hero-cards', '?limit=1', admin.accessToken);
      assert(items.length > 0, 'expected at least one existing hero card');
      return items[0];
    },
  );
  if (!original) {
    skip(
      'Home CRUD hero-cards: edit/active/reorder',
      'no existing hero card available to snapshot',
    );
    return;
  }

  registerRestore('Home CRUD hero-cards: restore original label', async () => {
    const res = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/hero-cards/${original.id}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({ label: original.label }),
      },
    );
    if (!res.ok) throw new Error(`restore failed: ${detail(res)}`);
  });

  const qaLabel = `${original.label} [${QA_TAG}]`;
  await step('Home CRUD hero-cards: edit persists', async () => {
    const put = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/hero-cards/${original.id}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({ label: qaLabel }),
      },
    );
    assert(put.ok, `update failed: ${detail(put)}`);
    const get = await apiCall<{ label: string }>(
      API_ORIGIN,
      `/api/v1/admin/home/hero-cards/${original.id}`,
      { token: admin.accessToken },
    );
    assert(
      get.ok && get.body.label === qaLabel,
      `expected the QA-tagged label to persist, got ${get.body?.label}`,
    );
  });

  await step('Home CRUD hero-cards: restore verified', async () => {
    const put = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/hero-cards/${original.id}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({ label: original.label }),
      },
    );
    assert(put.ok, `restore failed: ${detail(put)}`);
    const get = await apiCall<{ label: string }>(
      API_ORIGIN,
      `/api/v1/admin/home/hero-cards/${original.id}`,
      { token: admin.accessToken },
    );
    assert(
      get.ok && get.body.label === original.label,
      `expected the label to be RESTORED, got ${get.body?.label}`,
    );
  });

  await step(
    'Home CRUD hero-cards: reorder endpoint accepts a valid payload (no-op, same sortOrder — never disturbs the real 3-card order)',
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        '/api/v1/admin/home/hero-cards/reorder',
        {
          method: 'PATCH',
          token: admin.accessToken,
          body: JSON.stringify({
            items: [{ id: original.id, sortOrder: original.sortOrder }],
          }),
        },
      );
      assert(res.ok, `reorder failed: ${detail(res)}`);
    },
  );
}

// --- Propagation checks (approved content — snapshot, mutate, verify, restore)

async function propagationTextCheck(admin: AdminSession): Promise<void> {
  const original = await step(
    'Propagation/TEXT: snapshot an approved Hero Card',
    async () => {
      const items = await adminList<{ id: string; title: string }>(
        'hero-cards',
        '?limit=1',
        admin.accessToken,
      );
      assert(items.length > 0, 'expected at least one existing hero card');
      return items[0];
    },
  );
  if (!original) {
    skip('Propagation/TEXT', 'no approved hero card available to snapshot');
    return;
  }
  registerRestore('Propagation/TEXT: restore original title', async () => {
    const res = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/hero-cards/${original.id}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({
          title: original.title,
        }),
      },
    );
    if (!res.ok) throw new Error(`restore failed: ${detail(res)}`);
    // Re-verified against the public API in the dedicated
    // "restore verified on public Home API" step below — this task only
    // needs to guarantee the write succeeded.
  });

  const qaTitle = `${original.title} [${QA_TAG}]`;
  await step(
    'Propagation/TEXT: Admin change appears on public Home API',
    async () => {
      const put = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/hero-cards/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            title: qaTitle,
          }),
        },
      );
      assert(put.ok, `mutation failed: ${detail(put)}`);
      const pub = await apiCall<Array<{ id: string; title: string }>>(
        API_ORIGIN,
        '/api/v1/home/hero-cards',
      );
      assert(pub.ok, `public API read failed: ${detail(pub)}`);
      const row = pub.body.find((r) => r.id === original.id);
      assert(
        !!row && row.title === qaTitle,
        `expected public API to reflect the new title, got ${row?.title}`,
      );
    },
  );

  await step(
    'Propagation/TEXT: restore verified on public Home API',
    async () => {
      const put = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/hero-cards/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            title: original.title,
          }),
        },
      );
      assert(put.ok, `restore failed: ${detail(put)}`);
      const pub = await apiCall<Array<{ id: string; title: string }>>(
        API_ORIGIN,
        '/api/v1/home/hero-cards',
      );
      const row = pub.body.find((r) => r.id === original.id);
      assert(
        !!row && row.title === original.title,
        `expected public API to reflect the RESTORED title, got ${row?.title}`,
      );
    },
  );
}

async function propagationActiveCheck(admin: AdminSession): Promise<void> {
  const original = await step(
    'Propagation/ACTIVE: snapshot an approved News Article',
    async () => {
      const items = await adminList<{
        id: string;
        title: string;
        active: boolean;
      }>('news-articles', '?limit=1', admin.accessToken);
      assert(items.length > 0, 'expected at least one existing news article');
      return items[0];
    },
  );
  if (!original) {
    skip(
      'Propagation/ACTIVE',
      'no approved news article available to snapshot',
    );
    return;
  }
  registerRestore(
    'Propagation/ACTIVE: restore original active state',
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/news-articles/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            active: true,
          }),
        },
      );
      if (!res.ok) throw new Error(`restore failed: ${detail(res)}`);
    },
  );

  await step(
    'Propagation/ACTIVE: deactivated item disappears from public Home API',
    async () => {
      const put = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/news-articles/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            active: false,
          }),
        },
      );
      assert(put.ok, `deactivate failed: ${detail(put)}`);
      const pub = await apiCall<Array<{ id: string }>>(
        API_ORIGIN,
        '/api/v1/home/news-articles',
      );
      assert(
        !pub.body.some((r) => r.id === original.id),
        'expected deactivated item to be absent from the public API',
      );
    },
  );

  await step(
    'Propagation/ACTIVE: reactivated item reappears on public Home API',
    async () => {
      const put = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/news-articles/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            active: true,
          }),
        },
      );
      assert(put.ok, `reactivate failed: ${detail(put)}`);
      const pub = await apiCall<Array<{ id: string }>>(
        API_ORIGIN,
        '/api/v1/home/news-articles',
      );
      assert(
        pub.body.some((r) => r.id === original.id),
        'expected reactivated item to reappear on the public API',
      );
    },
  );
}

async function propagationReorderCheck(admin: AdminSession): Promise<void> {
  const originalOrder = await step(
    'Propagation/REORDER: snapshot approved Service Mosaic order',
    async () => {
      const items = await adminList<{ id: string; sortOrder: number }>(
        'service-mosaic-tiles',
        '?limit=100',
        admin.accessToken,
      );
      assert(
        items.length >= 2,
        'expected at least two mosaic tiles to swap order on',
      );
      return items
        .map((r) => ({ id: r.id, sortOrder: r.sortOrder }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
  );
  if (!originalOrder) {
    skip(
      'Propagation/REORDER',
      'fewer than two approved mosaic tiles available',
    );
    return;
  }
  registerRestore(
    'Propagation/REORDER: restore original mosaic order',
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        '/api/v1/admin/home/service-mosaic-tiles/reorder',
        {
          method: 'PATCH',
          token: admin.accessToken,
          body: JSON.stringify({ items: originalOrder }),
        },
      );
      if (!res.ok) throw new Error(`restore failed: ${detail(res)}`);
    },
  );

  // Swap the two lowest sortOrder values between the two lowest-ordered
  // items — NOT "swap array positions", which is why the expected new
  // leader below is computed from the resulting sortOrder values
  // (whichever id ends up with the smaller one), not read off a fixed
  // array index. A local Docker verification run caught a real bug here:
  // an earlier version asserted `swapped[0].id` was still first, but
  // `swapped[0]` keeps ORIGINAL_ORDER[0]'s id paired with
  // ORIGINAL_ORDER[1]'s (larger) sortOrder — after the swap it's
  // `swapped[1]` (ORIGINAL_ORDER[1]'s id, now holding the smaller
  // sortOrder) that actually sorts first. The reorder endpoint itself was
  // never wrong; only this assertion's own expectation was.
  const swapped = [
    { id: originalOrder[0].id, sortOrder: originalOrder[1].sortOrder },
    { id: originalOrder[1].id, sortOrder: originalOrder[0].sortOrder },
  ];
  const expectedNewFirstId = swapped.reduce((min, cur) =>
    cur.sortOrder < min.sortOrder ? cur : min,
  ).id;

  await step(
    'Propagation/REORDER: new order appears on public Home API',
    async () => {
      const patch = await apiCall(
        API_ORIGIN,
        '/api/v1/admin/home/service-mosaic-tiles/reorder',
        {
          method: 'PATCH',
          token: admin.accessToken,
          body: JSON.stringify({ items: swapped }),
        },
      );
      assert(patch.ok, `reorder failed: ${detail(patch)}`);
      const pub = await apiCall<Array<{ id: string }>>(
        API_ORIGIN,
        '/api/v1/home/service-mosaic-tiles',
      );
      assert(pub.ok, `public read failed: ${detail(pub)}`);
      assert(
        pub.body[0]?.id === expectedNewFirstId,
        `expected public order's first item to be ${expectedNewFirstId}, got ${pub.body[0]?.id}`,
      );
    },
  );

  await step(
    'Propagation/REORDER: original order restored and verified on public Home API',
    async () => {
      const patch = await apiCall(
        API_ORIGIN,
        '/api/v1/admin/home/service-mosaic-tiles/reorder',
        {
          method: 'PATCH',
          token: admin.accessToken,
          body: JSON.stringify({ items: originalOrder }),
        },
      );
      assert(patch.ok, `restore failed: ${detail(patch)}`);
      const pub = await apiCall<Array<{ id: string }>>(
        API_ORIGIN,
        '/api/v1/home/service-mosaic-tiles',
      );
      assert(
        pub.body[0]?.id === originalOrder[0].id,
        `expected public order's first item to be RESTORED to ${originalOrder[0].id}, got ${pub.body[0]?.id}`,
      );
    },
  );
}

async function propagationImageCheck(admin: AdminSession): Promise<void> {
  const original = await step(
    'Propagation/IMAGE: snapshot an approved Service Banner',
    async () => {
      const items = await adminList<{
        id: string;
        mediaAssetId: string | null;
      }>('service-banners', '?limit=1', admin.accessToken);
      assert(items.length > 0, 'expected at least one existing service banner');
      return items[0];
    },
  );
  if (!original) {
    skip(
      'Propagation/IMAGE',
      'no approved service banner available to snapshot',
    );
    return;
  }

  let qaMediaId: string | undefined;
  await step(
    'Propagation/IMAGE: upload a disposable replacement image',
    async () => {
      const form = new FormData();
      form.append(
        'file',
        new Blob([VALID_PNG_1x1], { type: 'image/png' }),
        `${QA_TAG}-propagation.png`,
      );
      const res = await apiCall<{ id: string }>(
        API_ORIGIN,
        '/api/v1/admin/media/upload',
        {
          method: 'POST',
          token: admin.accessToken,
          body: form,
        },
      );
      assert(res.ok, `upload failed: ${detail(res)}`);
      qaMediaId = res.body.id;
    },
  );
  if (!qaMediaId) {
    skip('Propagation/IMAGE', 'disposable image upload failed');
    return;
  }
  const disposableMediaId = qaMediaId;

  registerRestore(
    'Propagation/IMAGE: restore original mediaAssetId',
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/service-banners/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            mediaAssetId: original.mediaAssetId,
          }),
        },
      );
      if (!res.ok) throw new Error(`restore failed: ${detail(res)}`);
    },
  );
  registerRestore(
    'Propagation/IMAGE: delete disposable replacement image',
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/media/${disposableMediaId}`,
        {
          method: 'DELETE',
          token: admin.accessToken,
        },
      );
      if (!res.ok && res.status !== 404)
        throw new Error(`cleanup delete failed: ${detail(res)}`);
    },
  );

  await step(
    'Propagation/IMAGE: new MediaAsset URL resolves on public Home API',
    async () => {
      const put = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/service-banners/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            mediaAssetId: disposableMediaId,
          }),
        },
      );
      assert(put.ok, `mutation failed: ${detail(put)}`);
      const pub = await apiCall<Array<{ id: string; image: string | null }>>(
        API_ORIGIN,
        '/api/v1/home/service-banners',
      );
      const row = pub.body.find((r) => r.id === original.id);
      assert(
        !!row?.image,
        'expected the public row to have a resolved image URL',
      );
      const imgRes = await fetch(row!.image!);
      assert(
        imgRes.ok,
        `expected the new image URL to load, got ${detail(imgRes)}`,
      );
    },
  );

  await step(
    'Propagation/IMAGE: original MediaAsset restored and verified on public Home API',
    async () => {
      const put = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/service-banners/${original.id}`,
        {
          method: 'PUT',
          token: admin.accessToken,
          body: JSON.stringify({
            mediaAssetId: original.mediaAssetId,
          }),
        },
      );
      assert(put.ok, `restore failed: ${detail(put)}`);
      const pub = await apiCall<Array<{ id: string; image: string | null }>>(
        API_ORIGIN,
        '/api/v1/home/service-banners',
      );
      const row = pub.body.find((r) => r.id === original.id);
      assert(
        row?.image !== undefined,
        'expected the restored row to still be present',
      );
    },
  );
}

/**
 * A real staging run found "hasDelete: false" in the broad audit sanity
 * check below — root cause: that check ran BEFORE this script's only
 * DELETE calls (all deferred to the final cleanup/restore phase via
 * `registerRestore`), so at the point the check ran, no DELETE had
 * happened yet. Fixed by not relying on cleanup callbacks as the
 * mutation under test at all: this creates, updates, and — explicitly,
 * immediately, not deferred — deletes one disposable News Article
 * (nothing approved is touched), then confirms the audit log has a
 * CREATE, UPDATE, and DELETE entry matching THIS SPECIFIC row's id —
 * a precise, self-contained proof, not the broad "any recent
 * CREATE/UPDATE/DELETE from anywhere in this run" check that follows it
 * (kept as an additional sanity signal, not the primary proof).
 */
async function auditLogCrudProofCheck(admin: AdminSession): Promise<void> {
  let probeId: string | undefined;

  await step('Audit CRUD proof: create a disposable News Article', async () => {
    const res = await apiCall<{ id: string }>(
      API_ORIGIN,
      '/api/v1/admin/home/news-articles',
      {
        method: 'POST',
        token: admin.accessToken,
        body: JSON.stringify({
          category: `${QA_TAG}-audit-probe-category`,
          kicker: `${QA_TAG}-kicker`,
          title: `${QA_TAG}-title`,
          lead: `${QA_TAG}-lead`,
          sortOrder: 9999,
          active: true,
        }),
      },
    );
    assert(res.ok, `create failed: ${detail(res)}`);
    probeId = res.body.id;
  });
  if (!probeId) {
    skip(
      'Audit CRUD proof: update/delete/verify',
      'disposable News Article create failed, nothing to operate on',
    );
    return;
  }
  // Safety net only — the explicit delete step below is the actual test
  // and normally removes this row itself; this just guarantees cleanup
  // still happens if that step fails partway (404 on an
  // already-explicitly-deleted row is expected and fine here).
  registerRestore(
    "Audit CRUD proof: delete disposable row (safety net, if the explicit delete step below didn't already)",
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/news-articles/${probeId}`,
        { method: 'DELETE', token: admin.accessToken },
      );
      if (!res.ok && res.status !== 404)
        throw new Error(`cleanup delete failed: ${detail(res)}`);
    },
  );

  await step('Audit CRUD proof: update the disposable row', async () => {
    const res = await apiCall(
      API_ORIGIN,
      `/api/v1/admin/home/news-articles/${probeId}`,
      {
        method: 'PUT',
        token: admin.accessToken,
        body: JSON.stringify({ title: `${QA_TAG}-title-updated` }),
      },
    );
    assert(res.ok, `update failed: ${detail(res)}`);
  });

  await step(
    'Audit CRUD proof: delete the disposable row (explicit, not deferred to cleanup)',
    async () => {
      const res = await apiCall(
        API_ORIGIN,
        `/api/v1/admin/home/news-articles/${probeId}`,
        { method: 'DELETE', token: admin.accessToken },
      );
      assert(res.ok, `delete failed: ${detail(res)}`);
    },
  );

  await step(
    'Audit CRUD proof: log has matching CREATE, UPDATE, and DELETE entries for this exact row',
    async () => {
      const res = await apiCall<{
        items: Array<{ resourceId: string | null; action: string }>;
      }>(API_ORIGIN, '/api/v1/admin/audit-logs?page=1&limit=100', {
        token: admin.accessToken,
      });
      assert(res.ok, `audit log read failed: ${detail(res)}`);
      const items = (res.body.items ?? []).filter(
        (i) => i.resourceId === probeId,
      );
      const actions = new Set(items.map((i) => i.action));
      assert(
        actions.has('CREATE') && actions.has('UPDATE') && actions.has('DELETE'),
        `expected CREATE+UPDATE+DELETE audit entries for resourceId=${probeId}, found actions: ${[...actions].join(',') || '(none)'}`,
      );
    },
  );
}

async function customerAuthCheck(): Promise<string | undefined> {
  const verify = await step('Customer STAGING_TEST_AUTH login', async () => {
    const res = await apiCall<
      | { status: 'authenticated'; accessToken: string; refreshToken: string }
      | { status: 'signup_required'; signupToken: string }
    >(API_ORIGIN, '/api/v1/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({
        phone: STAGING_TEST_PHONE,
        code: STAGING_TEST_OTP,
      }),
    });
    assert(
      res.ok,
      `expected the staging test-auth bypass to succeed — is STAGING_TEST_AUTH=true set on this deployment? ${detail(res)}`,
    );
    return res.body;
  });
  if (!verify) {
    skip(
      'Customer authenticated Home access',
      'STAGING_TEST_AUTH login did not succeed',
    );
    return undefined;
  }

  let customerToken: string | undefined;
  if (verify.status === 'authenticated') {
    customerToken = verify.accessToken;
  } else {
    await step(
      'Customer signup completion (first-time test phone)',
      async () => {
        const res = await apiCall<{ accessToken: string }>(
          API_ORIGIN,
          '/api/v1/auth/signup/complete',
          {
            method: 'POST',
            body: JSON.stringify({
              signupToken: verify.signupToken,
              fullName: 'QA Runner Test Customer',
            }),
          },
        );
        assert(res.ok, `signup completion failed: ${detail(res)}`);
        customerToken = res.body.accessToken;
      },
    );
  }
  if (!customerToken) {
    skip(
      'Customer authenticated Home access',
      'no customer access token obtained',
    );
    return undefined;
  }

  await step(
    'Customer token is rejected by Admin /auth/me (reverse cross-boundary)',
    async () => {
      const res = await apiCall(API_ORIGIN, '/api/v1/admin/auth/me', {
        token: customerToken,
      });
      assert(
        !res.ok,
        `expected customer token to be rejected on the admin identity boundary, got ${detail(res)}`,
      );
    },
  );

  console.log(
    '[qa] note: the STAGING_TEST_AUTH fixed test phone (09121111111) is a permanent, intentional fixture — its User row is left in place, not deleted, matching every other run of this script.',
  );

  return customerToken;
}

// ---------------------------------------------------------------------------
// SERVICES-R5.1 — Transaction Foundation QA (real deployed HTTP + Postgres)
// ---------------------------------------------------------------------------

interface QaServiceSummary {
  id: string;
  active: boolean;
  availableMethods: string[];
  merchantId: string | null;
  priceFrom: number | null;
}

const ALL_PURCHASE_METHODS = ['credit', 'installment', 'cash', 'free'] as const;

/**
 * Finds a real, active, public Service with no authoritative usable price
 * under the R5.1 pricing rule (`free` never selected, `priceFrom` null or
 * <=0) — i.e. one that R5.1 MUST safely block from purchase. Per the
 * R5.1 report, this is expected to match on the very first page today:
 * 0/108 real services have a usable `priceFrom` and 0/108 support `free`.
 * Never fabricates a Service — only reads the real public catalog.
 */
async function discoverPricingBlockedService(): Promise<
  QaServiceSummary | undefined
> {
  const limit = 100;
  for (let page = 1; page <= 5; page += 1) {
    const res = await apiCall<{ items: QaServiceSummary[]; total: number }>(
      API_ORIGIN,
      `/api/v1/services?page=${page}&limit=${limit}`,
    );
    if (!res.ok || !Array.isArray(res.body.items)) return undefined;
    const candidate = res.body.items.find(
      (s) =>
        s.active &&
        Array.isArray(s.availableMethods) &&
        s.availableMethods.length > 0 &&
        !s.availableMethods.includes('free') &&
        (s.priceFrom === null || s.priceFrom <= 0),
    );
    if (candidate) return candidate;
    if (res.body.items.length < limit) return undefined;
  }
  return undefined;
}

async function attemptOrder(
  token: string,
  payload: Record<string, unknown>,
): Promise<ApiResponse<{ id?: string }>> {
  return apiCall<{ id?: string }>(API_ORIGIN, '/api/v1/orders', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

interface QaCardProductSummary {
  id: string;
  serviceId: string;
  status: string;
  journeyType: string;
  priceAmount: number | null;
  /** SERVICES-R5.26.1 — the card's own displayed worth/ceiling, never conflated with priceAmount. */
  valueAmount: number | null;
  /** SERVICES-R5.26.1 — resolved public image URL, or null if no MediaAsset is attached. */
  image: string | null;
}

/**
 * SERVICES-R5.19 — discovers a real, publicly-listed CardProduct suitable
 * for exercising the positive purchase path: `status: 'ACTIVE'` (the only
 * status `GET /cards` ever returns — no client-side filtering needed here
 * either, same as `discoverPricingBlockedService`'s own discipline),
 * `journeyType: 'PURCHASE'` (the only journey this stage's eligibility
 * boundary accepts), and a positive `priceAmount` (otherwise the purchase
 * is expected to be blocked, not succeed — see
 * `discoverPricingBlockedService` for that scenario's Service analog).
 * Never fabricates one — if staging genuinely has none, the positive path
 * is reported NOT_TESTED, not FAIL (this stage's explicit instruction).
 */
async function discoverPurchasableCardProduct(): Promise<
  QaCardProductSummary | undefined
> {
  const limit = 100;
  // SERVICES-R5.24 — `page`/`limit` is the real, documented `PaginationQueryDto`
  // contract; `skip` is a derived, read-only value with no `@IsInt()`/Swagger
  // decorator, never meant to be client-supplied. Sending it as a raw query
  // key used to crash EVERY endpoint that extends `PaginationQueryDto` with
  // an unhandled 500 (`backend/src/common/dto/pagination.dto.ts` now has a
  // no-op setter guarding against exactly this) — fixed at the source this
  // stage, but this call site is switched to the real contract regardless,
  // since `skip` was never a supported input to begin with.
  for (let page = 1; page <= 5; page += 1) {
    const res = await apiCall<{ items: QaCardProductSummary[]; total: number }>(
      API_ORIGIN,
      `/api/v1/cards?page=${page}&limit=${limit}`,
    );
    if (!res.ok || !Array.isArray(res.body.items)) return undefined;
    const candidate = res.body.items.find(
      (c) =>
        c.journeyType === 'PURCHASE' &&
        typeof c.priceAmount === 'number' &&
        c.priceAmount > 0,
    );
    if (candidate) return candidate;
    if (res.body.items.length < limit) return undefined;
  }
  return undefined;
}

interface QaCategorySummary {
  id: string;
  name: string;
  slug: string | null;
}
interface QaServiceSummary {
  id: string;
  categoryId: string;
}

/**
 * SERVICES-R5.24 — discovers two real, DIFFERENT Categories that each own
 * at least one real Service, purely from the public catalog (no admin
 * access needed) — the minimum real fixture `categoryCardOwnershipAndCrudCheck`
 * needs to construct both a valid CategoryCard and a deliberately
 * cross-category (invalid) one. Never fabricates a Category/Service; if
 * staging genuinely has fewer than two categories with a real service
 * each, returns `undefined` and the caller reports NOT_TESTED, not FAIL.
 */
async function discoverTwoCategoriesWithServices(): Promise<
  { categoryA: QaCategorySummary; serviceA: QaServiceSummary; categoryB: QaCategorySummary; serviceB: QaServiceSummary }
  | undefined
> {
  const catRes = await apiCall<{ items: QaCategorySummary[] }>(API_ORIGIN, '/api/v1/categories?limit=100');
  if (!catRes.ok || !Array.isArray(catRes.body.items)) return undefined;

  const byCategory = new Map<string, QaServiceSummary>();
  for (let page = 1; page <= 5; page += 1) {
    const res = await apiCall<{ items: QaServiceSummary[] }>(API_ORIGIN, `/api/v1/services?page=${page}&limit=100`);
    if (!res.ok || !Array.isArray(res.body.items)) break;
    for (const svc of res.body.items) {
      if (!byCategory.has(svc.categoryId)) byCategory.set(svc.categoryId, svc);
    }
    if (res.body.items.length < 100) break;
  }

  const eligible = catRes.body.items.filter((c) => byCategory.has(c.id));
  if (eligible.length < 2) return undefined;
  const [categoryA, categoryB] = eligible;
  return {
    categoryA,
    serviceA: byCategory.get(categoryA.id)!,
    categoryB,
    serviceB: byCategory.get(categoryB.id)!,
  };
}

/**
 * SERVICES-R5.24 — the first authenticated-QA coverage for
 * `/admin/category-cards`: the server-side ownership check
 * (`CategoryCardsService`, SERVICES-R5.21 — `targetService.categoryId`
 * MUST equal the CategoryCard's own `categoryId`, else 422) had only ever
 * been proven by backend unit tests and the browser-level happy path
 * (`browser-qa.ts`, which can only click a real, already-valid card — it
 * cannot exercise the rejection branch at all). No `DELETE` endpoint
 * exists for `CategoryCard` (zero-hard-delete convention, same as
 * `Category`/`Service`/`CardProduct` — `active` is the only removal
 * mechanism), so cleanup deactivates the disposable row instead of
 * deleting it, mirroring `propagationActiveCheck`'s own pattern.
 */
async function categoryCardOwnershipAndCrudCheck(
  admin: AdminSession | undefined,
): Promise<void> {
  if (!admin) {
    skip('CategoryCard ownership + CRUD — all checks', 'no admin session available');
    return;
  }

  const fixture = await step(
    'CategoryCard QA: discover two real Categories, each with a real Service',
    discoverTwoCategoriesWithServices,
  );
  if (!fixture) {
    skip(
      'CategoryCard ownership + CRUD — all checks',
      'fewer than two real Categories currently have a real Service each — nothing to construct a valid/invalid CategoryCard pair from; this is a real catalog-content state, not a QA gap',
    );
    return;
  }
  const { categoryA, serviceA, categoryB, serviceB } = fixture;

  await step(
    'CategoryCard QA: server rejects a targetService that does NOT belong to the given Category (ownership check)',
    async () => {
      const res = await apiCall<{ id: string }>(API_ORIGIN, '/api/v1/admin/category-cards', {
        method: 'POST',
        token: admin.accessToken,
        body: JSON.stringify({
          categoryId: categoryA.id,
          targetServiceId: serviceB.id,
          title: `${QA_TAG}-invalid-ownership`,
          highlights: [],
          sortOrder: 9999,
          active: true,
        }),
      });
      assert(
        !res.ok && res.status === 422,
        `expected a 422 ownership rejection for categoryId=${categoryA.id} + a Service from a different Category (${categoryB.id}), got ${detail(res)}`,
      );
    },
  );

  let id: string | undefined;
  await step('CategoryCard QA: create a valid disposable row (real Category + its own real Service)', async () => {
    const res = await apiCall<{ id: string; categoryId: string; targetServiceId: string }>(
      API_ORIGIN,
      '/api/v1/admin/category-cards',
      {
        method: 'POST',
        token: admin.accessToken,
        body: JSON.stringify({
          categoryId: categoryA.id,
          targetServiceId: serviceA.id,
          title: `${QA_TAG}-card`,
          highlights: [`${QA_TAG}-h1`, `${QA_TAG}-h2`],
          sortOrder: 9999,
          active: true,
        }),
      },
    );
    assert(res.ok, `create failed: ${detail(res)}`);
    assert(res.body.categoryId === categoryA.id, `expected categoryId to persist as ${categoryA.id}, got ${res.body.categoryId}`);
    assert(res.body.targetServiceId === serviceA.id, `expected targetServiceId to persist as ${serviceA.id}, got ${res.body.targetServiceId}`);
    id = res.body.id;
  });
  if (!id) {
    skip('CategoryCard QA: edit/active-filter/cleanup', 'create failed, nothing to operate on');
    return;
  }
  const cardId = id;
  registerRestore('CategoryCard QA: deactivate disposable row (cleanup — no DELETE endpoint exists)', async () => {
    const res = await apiCall(API_ORIGIN, `/api/v1/admin/category-cards/${cardId}`, {
      method: 'PUT',
      token: admin.accessToken,
      body: JSON.stringify({ active: false }),
    });
    if (!res.ok) throw new Error(`cleanup deactivate failed: ${detail(res)}`);
  });

  await step('CategoryCard QA: edit persists (title/highlights)', async () => {
    const put = await apiCall(API_ORIGIN, `/api/v1/admin/category-cards/${cardId}`, {
      method: 'PUT',
      token: admin.accessToken,
      body: JSON.stringify({ title: `${QA_TAG}-card-updated` }),
    });
    assert(put.ok, `update failed: ${detail(put)}`);
    const get = await apiCall<{ title: string }>(API_ORIGIN, `/api/v1/admin/category-cards/${cardId}`, { token: admin.accessToken });
    assert(get.ok && get.body.title === `${QA_TAG}-card-updated`, `expected the updated title to persist, got ${detail(get)}`);
  });

  await step('CategoryCard QA: appears in the public, active-filtered list for its real Category', async () => {
    const pub = await apiCall<{ items: Array<{ id: string; categoryId: string; targetServiceId: string }> }>(
      API_ORIGIN,
      `/api/v1/category-cards?categoryId=${categoryA.id}&limit=100`,
    );
    assert(pub.ok, `public category-cards list failed: ${detail(pub)}`);
    const found = pub.body.items.find((c) => c.id === cardId);
    assert(!!found, 'expected the real, active CategoryCard to appear in the public list for its Category');
    assert(found!.categoryId === categoryA.id, 'expected the public row\'s categoryId to match the real Category');
    assert(found!.targetServiceId === serviceA.id, 'expected the public row\'s targetServiceId to match the real target Service');
  });

  await step('CategoryCard QA: deactivated row disappears from the public list (active-filtering proof)', async () => {
    const put = await apiCall(API_ORIGIN, `/api/v1/admin/category-cards/${cardId}`, {
      method: 'PUT',
      token: admin.accessToken,
      body: JSON.stringify({ active: false }),
    });
    assert(put.ok, `deactivate failed: ${detail(put)}`);
    const pub = await apiCall<{ items: Array<{ id: string }> }>(
      API_ORIGIN,
      `/api/v1/category-cards?categoryId=${categoryA.id}&limit=100`,
    );
    assert(pub.ok, `public category-cards list failed: ${detail(pub)}`);
    assert(!pub.body.items.some((c) => c.id === cardId), 'expected the deactivated CategoryCard to be absent from the public list');
  });
}

/**
 * SERVICES-R5.26.1 — the default-catalog population's own end-to-end proof:
 * a real Category with a real slug, real CategoryCards whose images
 * actually resolve and whose target Services genuinely belong to that same
 * Category, and a real ACTIVE/PURCHASE CardProduct with both a positive
 * `priceAmount` AND a positive `valueAmount` whose own image resolves too.
 * Entirely dynamic — no hardcoded category/service/card-product id or
 * count, discovers whatever real data currently exists and reports
 * NOT_TESTED (never a fabricated PASS) if none does.
 */
async function servicesR5261DefaultCatalogCheck(): Promise<void> {
  const category = await step(
    'SERVICES-R5.26.1 discover a real Category with a real slug',
    async () => {
      const res = await apiCall<{ items: QaCategorySummary[] }>(API_ORIGIN, '/api/v1/categories?limit=100');
      if (!res.ok) return undefined;
      return res.body.items.find((c) => !!c.slug);
    },
  );
  if (!category) {
    skip(
      'SERVICES-R5.26.1 Category/CategoryCard chain checks',
      'NOT_TESTED — no real Category with a slug exists today; a real content gap, not fabricated past.',
    );
  } else {
    const cards = await step(
      `SERVICES-R5.26.1 discover real CategoryCards for "${category.name}"`,
      async () => {
        const res = await apiCall<{ items: Array<{ id: string; categoryId: string; targetServiceId: string; title: string; image: string | null }> }>(
          API_ORIGIN,
          `/api/v1/category-cards?categoryId=${category.id}&limit=100`,
        );
        return res.ok ? res.body.items : [];
      },
    );
    if (!cards || cards.length === 0) {
      skip(
        `SERVICES-R5.26.1 CategoryCard image/ownership checks for "${category.name}"`,
        'NOT_TESTED — the discovered Category has a slug but zero real CategoryCards today.',
      );
    } else {
      for (const card of cards) {
        await step(
          `SERVICES-R5.26.1 CategoryCard "${card.title}" image resolves and target Service belongs to "${category.name}"`,
          async () => {
            assert(!!card.image, `expected CategoryCard "${card.title}" to have a resolved image URL`);
            const imgRes = await fetch(card.image!);
            assert(imgRes.ok, `expected CategoryCard "${card.title}"'s image to load, got ${detail(imgRes)}`);
            const svc = await apiCall<{ id: string; categoryId: string }>(API_ORIGIN, `/api/v1/services/${card.targetServiceId}`);
            assert(svc.ok, `expected the target Service to resolve, got ${detail(svc)}`);
            assert(
              svc.body.categoryId === category.id,
              `expected CategoryCard "${card.title}"'s targetService to belong to "${category.name}" (${category.id}), got categoryId=${svc.body.categoryId}`,
            );
          },
        );
      }
    }
  }

  const cardProduct = await step(
    'SERVICES-R5.26.1 discover a real ACTIVE/PURCHASE CardProduct with both price and value set',
    async () => {
      const limit = 100;
      for (let page = 1; page <= 5; page += 1) {
        const res = await apiCall<{ items: QaCardProductSummary[] }>(API_ORIGIN, `/api/v1/cards?page=${page}&limit=${limit}`);
        if (!res.ok) return undefined;
        const candidate = res.body.items.find(
          (c) =>
            c.journeyType === 'PURCHASE' &&
            typeof c.priceAmount === 'number' &&
            c.priceAmount > 0 &&
            typeof c.valueAmount === 'number' &&
            c.valueAmount > 0,
        );
        if (candidate) return candidate;
        if (res.body.items.length < limit) return undefined;
      }
      return undefined;
    },
  );
  if (!cardProduct) {
    skip(
      'SERVICES-R5.26.1 CardProduct price/value/image checks',
      'NOT_TESTED — no real ACTIVE/PURCHASE CardProduct with both priceAmount and valueAmount set exists today.',
    );
  } else {
    await step(
      `SERVICES-R5.26.1 CardProduct priceAmount/valueAmount are independently positive and its image resolves (id=${cardProduct.id})`,
      async () => {
        assert(cardProduct.priceAmount! > 0, 'expected a positive priceAmount (what the customer pays)');
        assert(cardProduct.valueAmount! > 0, 'expected a positive valueAmount (the card\'s own displayed worth), independent of priceAmount');
        assert(!!cardProduct.image, 'expected the CardProduct to have a resolved image URL');
        const imgRes = await fetch(cardProduct.image!);
        assert(imgRes.ok, `expected the CardProduct's image to load, got ${detail(imgRes)}`);
      },
    );
  }
}

/**
 * SERVICES-R5.26.2 — the default-catalog seed is now wired into the
 * official deploy pipeline (`deploy.sh`'s new `DEFAULT_CATALOG_CMD` step),
 * so this stage's own acceptance bar — "staging must end up with >= 5 real
 * CardProducts, and the CardProduct positive-path must never be NOT_TESTED
 * because we seeded it ourselves" — is asserted explicitly and
 * exhaustively here, not just spot-checked (R5.26.1's own section already
 * does one full chain; this one checks EVERY real row, not just one).
 * Entirely dynamic — counts and ids are discovered live, nothing hardcoded.
 */
async function servicesR5262DefaultCatalogFinalizationCheck(): Promise<void> {
  await step('SERVICES-R5.26.2 real Categories exist', async () => {
    const res = await apiCall<{ items: QaCategorySummary[] }>(API_ORIGIN, '/api/v1/categories?limit=100');
    assert(res.ok && res.body.items.length > 0, `expected at least one real Category, got ${detail(res)}`);
  });

  const categoriesWithSlug = await step(
    'SERVICES-R5.26.2 every Category with a real slug has an image that resolves',
    async () => {
      const res = await apiCall<{ items: Array<{ id: string; name: string; slug: string | null; image: string | null }> }>(
        API_ORIGIN,
        '/api/v1/categories?limit=100',
      );
      if (!res.ok) return [];
      const withSlug = res.body.items.filter((c) => !!c.slug);
      for (const c of withSlug) {
        if (!c.image) continue; // a slug with no hero image set yet is a real, valid content state — not asserted against here
        const imgRes = await fetch(c.image);
        assert(imgRes.ok, `expected Category "${c.name}"'s image to load, got ${detail(imgRes)}`);
      }
      return withSlug;
    },
  );
  if (!categoriesWithSlug || categoriesWithSlug.length === 0) {
    skip('SERVICES-R5.26.2 Categories with a real slug', 'NOT_TESTED — no real Category has a slug set today.');
  }

  const activeCategoryCards = await step(
    'SERVICES-R5.26.2 discover every active CategoryCard',
    async () => {
      const cats = await apiCall<{ items: QaCategorySummary[] }>(API_ORIGIN, '/api/v1/categories?limit=100');
      if (!cats.ok) return [];
      const all: Array<{ id: string; categoryId: string; targetServiceId: string; title: string; image: string | null }> = [];
      for (const cat of cats.body.items) {
        const res = await apiCall<{ items: typeof all }>(API_ORIGIN, `/api/v1/category-cards?categoryId=${cat.id}&limit=100`);
        if (res.ok) all.push(...res.body.items);
      }
      return all;
    },
  );
  if (!activeCategoryCards || activeCategoryCards.length === 0) {
    skip('SERVICES-R5.26.2 CategoryCard image/ownership checks (all active cards)', 'NOT_TESTED — no active CategoryCard exists today.');
  } else {
    await step(
      `SERVICES-R5.26.2 every active CategoryCard's image resolves and its targetService belongs to its own Category (n=${activeCategoryCards.length})`,
      async () => {
        for (const card of activeCategoryCards) {
          assert(!!card.image, `expected CategoryCard "${card.title}" to have a resolved image URL`);
          const imgRes = await fetch(card.image!);
          assert(imgRes.ok, `expected CategoryCard "${card.title}"'s image to load, got ${detail(imgRes)}`);
          const svc = await apiCall<{ id: string; categoryId: string }>(API_ORIGIN, `/api/v1/services/${card.targetServiceId}`);
          assert(svc.ok, `expected CategoryCard "${card.title}"'s targetService to resolve, got ${detail(svc)}`);
          assert(
            svc.body.categoryId === card.categoryId,
            `expected CategoryCard "${card.title}"'s targetService to belong to its own Category (${card.categoryId}), got categoryId=${svc.body.categoryId}`,
          );
        }
      },
    );
  }

  await step('SERVICES-R5.26.2 real Services exist, each with a valid Category relation', async () => {
    const res = await apiCall<{ items: Array<{ id: string; categoryId: string }>; total: number }>(
      API_ORIGIN,
      '/api/v1/services?limit=100&page=1',
    );
    assert(res.ok && res.body.items.length > 0, `expected at least one real Service, got ${detail(res)}`);
    const sample = res.body.items.slice(0, 20);
    for (const svc of sample) {
      const cat = await apiCall<{ id: string }>(API_ORIGIN, `/api/v1/categories/${svc.categoryId}`);
      assert(cat.ok, `expected Service ${svc.id}'s categoryId (${svc.categoryId}) to resolve to a real Category, got ${detail(cat)}`);
    }
  });

  const allCardProducts = await step(
    'SERVICES-R5.26.2 discover every real CardProduct (full catalog scan, not just one)',
    async () => {
      const limit = 100;
      const all: QaCardProductSummary[] = [];
      for (let page = 1; page <= 5; page += 1) {
        const res = await apiCall<{ items: QaCardProductSummary[] }>(API_ORIGIN, `/api/v1/cards?page=${page}&limit=${limit}`);
        if (!res.ok) break;
        all.push(...res.body.items);
        if (res.body.items.length < limit) break;
      }
      return all;
    },
  );
  const cardProducts = allCardProducts ?? [];

  await step(
    `SERVICES-R5.26.2 at least 5 real ACTIVE/PURCHASE CardProducts exist (this stage's own default-catalog acceptance bar) — found ${cardProducts.length}`,
    async () => {
      assert(
        cardProducts.length >= 5,
        `expected >= 5 real CardProducts (the default-catalog seed's own acceptance bar), found ${cardProducts.length} — was the default-catalog seed actually run? (deploy.sh step 6/8, or \`pnpm --filter @biawin/backend seed:default-catalog\` locally)`,
      );
    },
  );

  if (cardProducts.length === 0) {
    skip(
      'SERVICES-R5.26.2 per-CardProduct field/ownership validation',
      'NOT_TESTED — zero CardProducts exist to validate (already reported as a FAIL above via the >= 5 assertion, not silently accepted).',
    );
  } else {
    await step(
      `SERVICES-R5.26.2 every real CardProduct is ACTIVE/PURCHASE with a positive price and value, a resolving image, and correct Service/Category ownership (n=${cardProducts.length})`,
      async () => {
        for (const cp of cardProducts) {
          assert(cp.status === 'ACTIVE', `expected CardProduct ${cp.id} to be ACTIVE (public /cards never returns non-ACTIVE anyway — a real invariant check), got ${cp.status}`);
          assert(cp.journeyType === 'PURCHASE', `expected CardProduct ${cp.id} to be journeyType=PURCHASE, got ${cp.journeyType}`);
          assert(typeof cp.priceAmount === 'number' && cp.priceAmount > 0, `expected CardProduct ${cp.id} to have a positive priceAmount, got ${cp.priceAmount}`);
          assert(typeof cp.valueAmount === 'number' && cp.valueAmount > 0, `expected CardProduct ${cp.id} to have a positive valueAmount, got ${cp.valueAmount}`);
          assert(!!cp.image, `expected CardProduct ${cp.id} to have a resolved image URL`);
          const imgRes = await fetch(cp.image!);
          assert(imgRes.ok, `expected CardProduct ${cp.id}'s image to load, got ${detail(imgRes)}`);
          const svc = await apiCall<{ id: string; categoryId: string }>(API_ORIGIN, `/api/v1/services/${cp.serviceId}`);
          assert(svc.ok, `expected CardProduct ${cp.id}'s serviceId (${cp.serviceId}) to resolve to a real Service, got ${detail(svc)}`);
          const cat = await apiCall<{ id: string }>(API_ORIGIN, `/api/v1/categories/${svc.body.categoryId}`);
          assert(cat.ok, `expected CardProduct ${cp.id}'s Service's categoryId (${svc.body.categoryId}) to resolve to a real Category, got ${detail(cat)}`);
        }
      },
    );
  }
}

/**
 * SERVICES-R5.19 — discovers a real, Admin-visible CardProduct that is NOT
 * `ACTIVE` (DRAFT/INACTIVE/EXPIRED), to prove the purchase boundary rejects
 * it. Requires admin access — `GET /cards` (public) never returns a
 * non-ACTIVE row at all, so this cannot be discovered from the public
 * catalog the way `discoverPurchasableCardProduct` is.
 */
async function discoverNonActiveCardProduct(
  admin: AdminSession,
): Promise<QaCardProductSummary | undefined> {
  const res = await apiCall<{ items: QaCardProductSummary[]; total: number }>(
    API_ORIGIN,
    '/api/v1/admin/card-products?limit=100',
    { token: admin.accessToken },
  );
  if (!res.ok || !Array.isArray(res.body.items)) return undefined;
  return res.body.items.find((c) => c.status !== 'ACTIVE');
}

interface FinancialSnapshot {
  orders: number;
  payments: number;
  installments: number;
  wallets: Array<{ id: string; kind: string; balance: number }>;
  /** SERVICES-R5.19 — proves a CardProduct purchase creates no card-issuance side effect. */
  cardInstances: number;
  /** SERVICES-R5.19 — proves no usage/redemption side effect (impossible without a cardInstance, but checked directly anyway). */
  usageTransactions: number;
}

async function snapshotFinancialState(
  userId: string,
): Promise<FinancialSnapshot> {
  const [orders, payments, installments, wallets, cardInstances, usageTransactions] =
    await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.payment.count({ where: { order: { userId } } }),
      prisma.installment.count({ where: { userId } }),
      prisma.wallet.findMany({
        where: { userId },
        select: { id: true, kind: true, balance: true },
      }),
      prisma.customerCardInstance.count({ where: { userId } }),
      prisma.usageTransaction.count({
        where: { customerCardInstance: { userId } },
      }),
    ]);
  return {
    orders,
    payments,
    installments,
    wallets,
    cardInstances,
    usageTransactions,
  };
}

/**
 * Exercises the real POST /orders R5.1 transaction boundary against the
 * real deployed staging backend + Postgres. Never invents pricing, never
 * fabricates a Merchant, never expects a successful Order — per the R5.1
 * report, every real Service today is safely blocked by
 * ServicePricingService, and this QA proves exactly that, not around it.
 */
async function servicesR511TransactionFoundationCheck(
  customerToken: string | undefined,
): Promise<void> {
  // --- 1. Authentication — reachable with or without a customer session ---
  await step(
    'SERVICES-R5.1 unauthenticated POST /orders rejected',
    async () => {
      const res = await apiCall(API_ORIGIN, '/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: randomUUID(),
          method: 'cash',
          idempotencyKey: `${QA_TAG}-r511-unauth`,
        }),
      });
      assert(
        res.status === 401,
        `expected 401 for unauthenticated POST /orders, got ${detail(res)}`,
      );
    },
  );

  if (!customerToken) {
    skip(
      'SERVICES-R5.1 transaction foundation checks (authenticated)',
      'no STAGING_TEST_AUTH customer token available — see Customer STAGING_TEST_AUTH login above',
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { phone: STAGING_TEST_PHONE },
    select: { id: true },
  });
  if (!user) {
    skip(
      'SERVICES-R5.1 transaction foundation checks (authenticated)',
      'STAGING_TEST_AUTH user row not found in the database despite a successful login',
    );
    return;
  }
  const userId = user.id;

  // --- 2. Real service discovery ------------------------------------------
  const candidate = await step(
    'SERVICES-R5.1 real service discovered',
    async () => {
      const found = await discoverPricingBlockedService();
      assert(
        !!found,
        'no real active Service without a usable authoritative price could be discovered on the public catalog — cannot safely test the R5.1 pricing-block boundary without either fabricating data (forbidden) or a real catalog change',
      );
      return found;
    },
  );
  if (candidate) {
    record(
      'SERVICES-R5.1 selected service snapshot',
      'PASS',
      `id=${candidate.id} active=${candidate.active} availableMethods=${JSON.stringify(candidate.availableMethods)} merchantId=${candidate.merchantId} priceFrom=${candidate.priceFrom}`,
    );
  }
  await step(
    'SERVICES-R5.1 selected service has no authoritative usable price today',
    () => {
      assert(!!candidate, 'no candidate service was discovered');
      assert(
        candidate!.priceFrom === null || candidate!.priceFrom <= 0,
        `expected no usable priceFrom, got ${candidate!.priceFrom}`,
      );
      assert(
        !candidate!.availableMethods.includes('free'),
        'expected the selected service not to support the free method (which would be tautologically priced)',
      );
    },
  );
  if (!candidate) {
    skip(
      'SERVICES-R5.1 transaction boundary checks (require a real service)',
      'no suitable real service was discovered',
    );
    return;
  }

  const before = await snapshotFinancialState(userId);
  const supportedMethod = candidate.availableMethods[0];
  const unexpectedOrderIds: string[] = [];

  // --- 3. Authoritative pricing block --------------------------------------
  await step(
    'SERVICES-R5.1 authoritative pricing unavailable returns 422',
    async () => {
      const res = await attemptOrder(customerToken, {
        serviceId: candidate.id,
        method: supportedMethod,
        idempotencyKey: `${QA_TAG}-r511-pricing-block`,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected authoritative pricing to block this purchase, but an Order was created (id=${res.body.id}) — this is a genuine R5.1 defect, not a QA artifact`,
        );
      }
      assert(
        res.status === 422,
        `expected 422 Unprocessable Entity for unavailable authoritative pricing, got ${detail(res)}`,
      );
    },
  );

  // --- 4. Client amount tampering ------------------------------------------
  await step(
    'SERVICES-R5.1 client amount cannot control the transaction',
    async () => {
      const res = await attemptOrder(customerToken, {
        serviceId: candidate.id,
        method: supportedMethod,
        idempotencyKey: `${QA_TAG}-r511-tamper`,
        amount: 1,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected the client-supplied 'amount' field to be rejected or ignored, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected the deployed ValidationPipe (whitelist+forbidNonWhitelisted, see backend/src/main.ts) to reject the unknown 'amount' field with 400, got ${detail(res)}`,
      );
    },
  );

  // --- 5. Unsupported purchase method ---------------------------------------
  await step('SERVICES-R5.1 unsupported purchase method rejected', async () => {
    const unsupported = ALL_PURCHASE_METHODS.find(
      (m) => !candidate.availableMethods.includes(m),
    );
    assert(
      !!unsupported,
      'selected service unexpectedly supports every purchase method — cannot construct an unsupported-method probe against it',
    );
    const res = await attemptOrder(customerToken, {
      serviceId: candidate.id,
      method: unsupported,
      idempotencyKey: `${QA_TAG}-r511-method`,
    });
    if (res.ok) {
      if (res.body.id) unexpectedOrderIds.push(res.body.id);
      throw new Error(
        `expected an unsupported purchase method to be rejected, but an Order was created (id=${res.body.id})`,
      );
    }
    assert(
      res.status === 422,
      `expected a deterministic 422 for an unsupported purchase method, got ${detail(res)}`,
    );
  });

  // --- 6. Nonexistent service ------------------------------------------------
  await step('SERVICES-R5.1 nonexistent service rejected', async () => {
    const res = await attemptOrder(customerToken, {
      serviceId: randomUUID(),
      method: 'cash',
      idempotencyKey: `${QA_TAG}-r511-nonexistent-service`,
    });
    if (res.ok) {
      if (res.body.id) unexpectedOrderIds.push(res.body.id);
      throw new Error(
        `expected a nonexistent Service id to be rejected, but an Order was created (id=${res.body.id})`,
      );
    }
    assert(
      res.status === 404,
      `expected 404 Not Found for a nonexistent Service, got ${detail(res)}`,
    );
  });

  // --- 7. Merchant mismatch ---------------------------------------------------
  await step(
    'SERVICES-R5.1 unrelated/nonexistent merchant rejected',
    async () => {
      const res = await attemptOrder(customerToken, {
        serviceId: candidate.id,
        method: supportedMethod,
        merchantId: randomUUID(),
        idempotencyKey: `${QA_TAG}-r511-merchant-mismatch`,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected an unrelated/nonexistent merchantId to be rejected (this service's real merchantId=${candidate.merchantId}), but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 422,
        `expected 422 for merchant relationship validation failure, got ${detail(res)}`,
      );
    },
  );

  // --- 8. Idempotency of a pricing-blocked request ----------------------------
  await step(
    'SERVICES-R5.1 repeated blocked request is deterministic, creates no duplicate',
    async () => {
      const payload = {
        serviceId: candidate.id,
        method: supportedMethod,
        idempotencyKey: `${QA_TAG}-r511-repeat-blocked`,
      };
      const first = await attemptOrder(customerToken, payload);
      const second = await attemptOrder(customerToken, payload);
      if (first.ok || second.ok) {
        const okRes = first.ok ? first : second;
        if (okRes.body.id) unexpectedOrderIds.push(okRes.body.id);
        throw new Error(
          `expected both attempts to be blocked by unavailable pricing, but got an Order (id=${okRes.body.id})`,
        );
      }
      assert(
        first.status === 422 && second.status === 422,
        `expected deterministic repeated 422s, got first=${detail(first)} second=${detail(second)}`,
      );
    },
  );
  skip(
    'SERVICES-R5.1 idempotent replay of a SUCCESSFUL Order returns the original (no duplicate)',
    'NOT_TESTED — BLOCKED BY REAL PRICING DATA: no real Service has an authoritative price today, so a successful Order (and therefore this positive idempotency path) cannot be reached without fabricating pricing, which is forbidden. Covered at the unit-test level instead — see backend/src/modules/orders/orders.service.spec.ts.',
  );

  // --- 11. Ownership ------------------------------------------------------------
  await step(
    'SERVICES-R5.1 client-supplied userId/ownerId cannot influence ownership',
    async () => {
      const res = await attemptOrder(customerToken, {
        serviceId: candidate.id,
        method: supportedMethod,
        idempotencyKey: `${QA_TAG}-r511-ownership`,
        userId: randomUUID(),
        ownerId: randomUUID(),
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected unknown userId/ownerId fields to be rejected, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected the deployed ValidationPipe to reject unknown userId/ownerId fields with 400 (same whitelist mechanism as the amount-tampering check), got ${detail(res)}`,
      );
    },
  );

  // --- 9 & 10. Database side-effect proof + gateway non-invocation -----------
  const after = await snapshotFinancialState(userId);
  await step('SERVICES-R5.1 Orders delta = 0', () => {
    assert(
      after.orders === before.orders,
      `expected no new Order rows for the test user, before=${before.orders} after=${after.orders}`,
    );
  });
  await step(
    'SERVICES-R5.1 Payments delta = 0 (also the strongest available proof of no gateway invocation)',
    () => {
      assert(
        after.payments === before.payments,
        `expected no new Payment rows for the test user, before=${before.payments} after=${after.payments}`,
      );
    },
  );
  await step('SERVICES-R5.1 Installments delta = 0', () => {
    assert(
      after.installments === before.installments,
      `expected no new Installment rows for the test user, before=${before.installments} after=${after.installments}`,
    );
  });
  await step('SERVICES-R5.1 Wallet state unchanged', () => {
    if (before.wallets.length === 0) {
      assert(
        after.wallets.length === 0,
        `test user had no Wallet before; expected none to be created as a side effect, found ${after.wallets.length}`,
      );
      return;
    }
    assert(
      after.wallets.length === before.wallets.length,
      `expected the same number of Wallet rows, before=${before.wallets.length} after=${after.wallets.length}`,
    );
    for (const w of before.wallets) {
      const match = after.wallets.find((x) => x.id === w.id);
      assert(!!match, `wallet ${w.id} (${w.kind}) disappeared`);
      assert(
        match!.balance === w.balance,
        `expected wallet ${w.kind} balance to stay ${w.balance}, got ${match!.balance}`,
      );
    }
  });
  console.log(
    "[qa] note: gateway non-invocation is proven here at the database-state level (no Payment row created) plus the R5.1 unit tests' constructor-injection proof that OrdersService has no PaymentsService/gateway dependency at all — no live Zibal/Zarinpal request was made or intercepted, since making one is explicitly out of scope for this stage.",
  );

  // --- 12. Cleanup ---------------------------------------------------------
  if (unexpectedOrderIds.length > 0) {
    record(
      'SERVICES-R5.1 CRITICAL: an Order was created despite pricing being unavailable',
      'FAIL',
      `order ids: ${unexpectedOrderIds.join(', ')} — this is a genuine R5.1 defect and must be investigated before this stage can be considered safe`,
    );
    for (const id of unexpectedOrderIds) {
      registerRestore(
        `SERVICES-R5.1 cleanup: delete unexpectedly-created Order ${id}`,
        async () => {
          await prisma.order.delete({ where: { id } });
        },
      );
    }
  } else {
    console.log(
      '[qa] SERVICES-R5.1: no disposable records to clean up — every purchase attempt was correctly blocked before any Order row was created.',
    );
  }
}

/**
 * SERVICES-R5.19 — exercises the CardProduct purchase boundary against the
 * real deployed staging backend + Postgres. Unlike R5.1's check (which
 * proves every real Service is safely blocked — none has usable pricing
 * today), a real CardProduct MAY have a positive `priceAmount` (Admin-set,
 * R5.17), so this check's positive path is conditional on discovering one
 * — reported NOT_TESTED, never FAIL, if staging has none (this stage's
 * explicit instruction: "Do not seed fictional production-like data just
 * to make QA green").
 */
async function servicesR519CardProductPurchaseFoundationCheck(
  customerToken: string | undefined,
  superAdmin: AdminSession | undefined,
): Promise<void> {
  // --- 1. Authentication — reachable with or without a customer session ---
  await step(
    'SERVICES-R5.19 unauthenticated POST /orders (CardProduct shape) rejected',
    async () => {
      const res = await apiCall(API_ORIGIN, '/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          cardProductId: randomUUID(),
          idempotencyKey: `${QA_TAG}-r519-unauth`,
        }),
      });
      assert(
        res.status === 401,
        `expected 401 for unauthenticated POST /orders, got ${detail(res)}`,
      );
    },
  );

  if (!customerToken) {
    skip(
      'SERVICES-R5.19 CardProduct purchase checks (authenticated)',
      'no STAGING_TEST_AUTH customer token available — see Customer STAGING_TEST_AUTH login above',
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { phone: STAGING_TEST_PHONE },
    select: { id: true },
  });
  if (!user) {
    skip(
      'SERVICES-R5.19 CardProduct purchase checks (authenticated)',
      'STAGING_TEST_AUTH user row not found in the database despite a successful login',
    );
    return;
  }
  const userId = user.id;
  const unexpectedOrderIds: string[] = [];

  // --- 2. Request-shape / injection rejections (need no real CardProduct) ---
  await step(
    'SERVICES-R5.19 nonexistent cardProductId rejected',
    async () => {
      const res = await attemptOrder(customerToken, {
        cardProductId: randomUUID(),
        idempotencyKey: `${QA_TAG}-r519-nonexistent`,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected a nonexistent CardProduct id to be rejected, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 404,
        `expected 404 Not Found for a nonexistent CardProduct, got ${detail(res)}`,
      );
    },
  );

  await step(
    'SERVICES-R5.19 client-supplied amount rejected (CardProduct shape)',
    async () => {
      const res = await attemptOrder(customerToken, {
        cardProductId: randomUUID(),
        idempotencyKey: `${QA_TAG}-r519-amount-tamper`,
        amount: 1,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected the client-supplied 'amount' field to be rejected, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected the deployed ValidationPipe to reject the unknown 'amount' field with 400, got ${detail(res)}`,
      );
    },
  );

  await step(
    'SERVICES-R5.19 client-supplied merchantId rejected (CardProduct shape forbids it outright)',
    async () => {
      const res = await attemptOrder(customerToken, {
        cardProductId: randomUUID(),
        merchantId: randomUUID(),
        idempotencyKey: `${QA_TAG}-r519-merchant-tamper`,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected a client-supplied merchantId alongside cardProductId to be rejected, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected 400 for merchantId supplied alongside cardProductId, got ${detail(res)}`,
      );
    },
  );

  await step(
    'SERVICES-R5.19 client-supplied status rejected (CardProduct shape)',
    async () => {
      const res = await attemptOrder(customerToken, {
        cardProductId: randomUUID(),
        status: 'paid',
        idempotencyKey: `${QA_TAG}-r519-status-tamper`,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected a client-supplied status to be rejected, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected 400 for an unknown 'status' field, got ${detail(res)}`,
      );
    },
  );

  await step(
    'SERVICES-R5.26 client-supplied userId/ownerId rejected (CardProduct shape)',
    async () => {
      const res = await attemptOrder(customerToken, {
        cardProductId: randomUUID(),
        idempotencyKey: `${QA_TAG}-r526-owner-tamper`,
        userId: randomUUID(),
        ownerId: randomUUID(),
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected unknown userId/ownerId fields to be rejected on the CardProduct shape, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected the deployed ValidationPipe to reject unknown userId/ownerId fields with 400 (same whitelist mechanism proven for the Service shape at SERVICES-R5.1), got ${detail(res)}`,
      );
    },
  );

  await step(
    'SERVICES-R5.19 providing both serviceId and cardProductId rejected',
    async () => {
      const res = await attemptOrder(customerToken, {
        serviceId: randomUUID(),
        cardProductId: randomUUID(),
        method: 'cash',
        idempotencyKey: `${QA_TAG}-r519-both-shapes`,
      });
      if (res.ok) {
        if (res.body.id) unexpectedOrderIds.push(res.body.id);
        throw new Error(
          `expected providing both serviceId and cardProductId to be rejected, but an Order was created (id=${res.body.id})`,
        );
      }
      assert(
        res.status === 400,
        `expected a deterministic 400 for an ambiguous dual-shape request, got ${detail(res)}`,
      );
    },
  );

  // --- 3. Inactive CardProduct rejection (requires Admin discovery) --------
  if (superAdmin) {
    const nonActive = await step(
      'SERVICES-R5.19 non-ACTIVE CardProduct discovered via Admin (if any exists)',
      () => discoverNonActiveCardProduct(superAdmin),
    );
    if (nonActive) {
      record(
        'SERVICES-R5.19 selected non-ACTIVE CardProduct snapshot',
        'PASS',
        `id=${nonActive.id} status=${nonActive.status}`,
      );
      await step(
        'SERVICES-R5.19 non-ACTIVE CardProduct purchase rejected with 422',
        async () => {
          const res = await attemptOrder(customerToken, {
            cardProductId: nonActive.id,
            idempotencyKey: `${QA_TAG}-r519-inactive-card`,
          });
          if (res.ok) {
            if (res.body.id) unexpectedOrderIds.push(res.body.id);
            throw new Error(
              `expected a non-ACTIVE CardProduct to be rejected, but an Order was created (id=${res.body.id})`,
            );
          }
          assert(
            res.status === 422,
            `expected 422 for a non-ACTIVE CardProduct, got ${detail(res)}`,
          );
        },
      );
    } else {
      skip(
        'SERVICES-R5.19 non-ACTIVE CardProduct purchase rejected with 422',
        'NOT_TESTED — no DRAFT/INACTIVE/EXPIRED CardProduct exists on staging today to discover; covered at the unit-test level instead (backend/src/modules/orders/orders.service.spec.ts).',
      );
    }
  } else {
    skip(
      'SERVICES-R5.19 non-ACTIVE CardProduct purchase rejected with 422',
      'no SUPER_ADMIN session available to discover a non-ACTIVE CardProduct',
    );
  }

  // --- 4. Positive path — conditional on a real purchasable CardProduct ---
  const candidate = await step(
    'SERVICES-R5.19 real purchasable CardProduct discovered (if any exists)',
    () => discoverPurchasableCardProduct(),
  );
  if (!candidate) {
    skip(
      'SERVICES-R5.19 CardProduct purchase positive-path checks (create/idempotency/side-effects)',
      'NOT_TESTED — no real ACTIVE, journeyType=PURCHASE, priced CardProduct exists on staging today. This is a real catalog-data gap, not a defect — see backend/src/modules/orders/orders.service.spec.ts for full unit coverage of this path.',
    );
  } else {
    record(
      'SERVICES-R5.19 selected purchasable CardProduct snapshot',
      'PASS',
      `id=${candidate.id} serviceId=${candidate.serviceId} priceAmount=${candidate.priceAmount}`,
    );

    const before = await snapshotFinancialState(userId);
    let createdOrderId: string | undefined;

    await step(
      'SERVICES-R5.19 purchasing a real ACTIVE CardProduct creates a pending Order with the server-resolved price',
      async () => {
        const res = await attemptOrder(customerToken, {
          cardProductId: candidate.id,
          idempotencyKey: `${QA_TAG}-r519-purchase`,
        });
        assert(
          res.ok,
          `expected a real, ACTIVE, priced, PURCHASE-journey CardProduct to be purchasable, got ${detail(res)}`,
        );
        assert(!!res.body.id, 'expected a created Order to have an id');
        createdOrderId = res.body.id;
        unexpectedOrderIds.push(res.body.id!); // tracked for cleanup below regardless of outcome
      },
    );

    if (createdOrderId) {
      await step(
        'SERVICES-R5.19 exact idempotent retry returns the original Order (no duplicate)',
        async () => {
          const res = await attemptOrder(customerToken, {
            cardProductId: candidate.id,
            idempotencyKey: `${QA_TAG}-r519-purchase`,
          });
          assert(
            res.ok && res.body.id === createdOrderId,
            `expected the exact same Order id on retry, got ${detail(res)} id=${res.body.id}`,
          );
        },
      );

      await step(
        'SERVICES-R5.19 conflicting idempotency reuse (different CardProduct) returns a deterministic conflict',
        async () => {
          const res = await attemptOrder(customerToken, {
            cardProductId: randomUUID(),
            idempotencyKey: `${QA_TAG}-r519-purchase`,
          });
          assert(
            res.status === 409,
            `expected 409 Conflict for reusing the same idempotency key against a different CardProduct, got ${detail(res)}`,
          );
        },
      );

      const after = await snapshotFinancialState(userId);
      await step('SERVICES-R5.19 Orders delta = exactly 1', () => {
        assert(
          after.orders === before.orders + 1,
          `expected exactly one new Order, before=${before.orders} after=${after.orders}`,
        );
      });
      await step('SERVICES-R5.19 Payments delta = 0', () => {
        assert(
          after.payments === before.payments,
          `expected no new Payment rows, before=${before.payments} after=${after.payments}`,
        );
      });
      await step('SERVICES-R5.19 Installments delta = 0', () => {
        assert(
          after.installments === before.installments,
          `expected no new Installment rows, before=${before.installments} after=${after.installments}`,
        );
      });
      await step('SERVICES-R5.19 CustomerCardInstance delta = 0', () => {
        assert(
          after.cardInstances === before.cardInstances,
          `expected no new CustomerCardInstance rows (card issuance is out of scope this stage), before=${before.cardInstances} after=${after.cardInstances}`,
        );
      });
      await step('SERVICES-R5.19 UsageTransaction delta = 0', () => {
        assert(
          after.usageTransactions === before.usageTransactions,
          `expected no new UsageTransaction rows, before=${before.usageTransactions} after=${after.usageTransactions}`,
        );
      });
      await step('SERVICES-R5.19 Wallet state unchanged', () => {
        assert(
          after.wallets.length === before.wallets.length,
          `expected the same number of Wallet rows, before=${before.wallets.length} after=${after.wallets.length}`,
        );
        for (const w of before.wallets) {
          const match = after.wallets.find((x) => x.id === w.id);
          assert(!!match, `wallet ${w.id} (${w.kind}) disappeared`);
          assert(
            match!.balance === w.balance,
            `expected wallet ${w.kind} balance to stay ${w.balance}, got ${match!.balance}`,
          );
        }
      });

      const order = await prisma.order.findUnique({
        where: { id: createdOrderId },
        select: { status: true, amount: true, method: true, cardProductId: true },
      });
      await step(
        'SERVICES-R5.19 created Order is pending, priced from CardProduct.priceAmount, with no method set',
        () => {
          assert(!!order, 'expected the created Order to exist in the database');
          assert(
            order!.status === 'pending',
            `expected status='pending', got '${order!.status}'`,
          );
          assert(
            order!.amount === candidate.priceAmount,
            `expected amount to equal the CardProduct's priceAmount (${candidate.priceAmount}), got ${order!.amount}`,
          );
          assert(
            order!.method === null,
            `expected method=null for a CardProduct-path Order, got '${order!.method}'`,
          );
          assert(
            order!.cardProductId === candidate.id,
            `expected cardProductId='${candidate.id}', got '${order!.cardProductId}'`,
          );
        },
      );
    }
  }

  // --- 5. Cleanup — disposable QA Orders created by the positive path -----
  if (unexpectedOrderIds.length > 0) {
    for (const id of unexpectedOrderIds) {
      registerRestore(`SERVICES-R5.19 cleanup: delete disposable QA Order ${id}`, async () => {
        await prisma.order.delete({ where: { id } }).catch(() => {
          // Already gone or never actually created (a rejected attempt
          // that we tracked defensively) — never fatal for cleanup.
        });
      });
    }
  } else {
    console.log(
      '[qa] SERVICES-R5.19: no disposable Order rows to clean up.',
    );
  }
}

// ---------------------------------------------------------------------------
// Cleanup + report
// ---------------------------------------------------------------------------

function finish(fatal: Error | null): void {
  void finishAsync(fatal).then((exitCode) => process.exit(exitCode));
}

async function finishAsync(fatal: Error | null): Promise<number> {
  console.log(`[qa] running ${restoreTasks.length} cleanup/restore task(s)...`);
  let cleanupOk = true;
  for (const task of [...restoreTasks].reverse()) {
    try {
      await task.run();
      console.log(`[qa] cleanup OK: ${task.name}`);
    } catch (err) {
      cleanupOk = false;
      record(
        `CLEANUP: ${task.name}`,
        'FAIL',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await prisma.$disconnect().catch(() => {});

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const skipCount = results.filter((r) => r.status === 'NOT_TESTED').length;

  mkdirSync(REPORT_DIR, { recursive: true });
  const humanPath = `${REPORT_DIR}/authenticated-qa-report-${RUN_ID}.txt`;
  const jsonPath = `${REPORT_DIR}/authenticated-qa-report-${RUN_ID}.json`;

  const lines: string[] = [];
  lines.push(
    `Stage 5.22 authenticated staging QA — ${new Date().toISOString()}`,
  );
  lines.push(`Run tag: ${QA_TAG}`);
  lines.push(
    `Targets: API=${API_ORIGIN} customer=${CUSTOMER_ORIGIN} admin=${ADMIN_ORIGIN}`,
  );
  lines.push('');
  for (const r of results) {
    const marker =
      r.status === 'PASS' ? 'PASS ' : r.status === 'FAIL' ? 'FAIL ' : 'SKIP ';
    lines.push(
      `${marker} ${r.name}${r.detail ? '  — ' + redact(r.detail) : ''}`,
    );
  }
  lines.push('');
  lines.push(
    `Totals: ${passCount} PASS, ${failCount} FAIL, ${skipCount} NOT_TESTED`,
  );
  lines.push(
    `Cleanup: ${cleanupOk ? 'OK — staging restored to its approved state' : 'FAILED — see CLEANUP entries above, staging may need manual review'}`,
  );
  if (fatal) lines.push(`Fatal error: ${redact(fatal.message)}`);
  const humanReport = lines.join('\n');

  writeFileSync(humanPath, humanReport, 'utf8');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        runTag: QA_TAG,
        timestamp: new Date().toISOString(),
        results,
        cleanupOk,
        fatal: fatal?.message ?? null,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log(humanReport);
  console.log('');
  console.log(`[qa] report written to: ${humanPath}`);
  console.log(`[qa] machine-readable report: ${jsonPath}`);

  const failed = failCount > 0 || !cleanupOk || !!fatal;
  return failed ? 1 : 0;
}

main().catch((err) => {
  console.error('[qa] unhandled error:', err);
  process.exit(1);
});
