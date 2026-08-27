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
  fn: () => Promise<T>,
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
  const res = await fetch(`${origin}${path}`, { ...init, headers });
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
  assert(
    res.ok,
    `login failed: HTTP ${res.status}${res.errorMessage ? ' — ' + res.errorMessage : ''}`,
  );
  assert(
    typeof res.body.accessToken === 'string' && res.body.accessToken.length > 0,
    `login returned HTTP ${res.status} but no usable accessToken — got: ${JSON.stringify(res.body).slice(0, 200)}`,
  );
  const me = await apiCall<{ role: string; email: string }>(
    API_ORIGIN,
    '/api/v1/admin/auth/me',
    {
      token: res.body.accessToken,
    },
  );
  assert(
    me.ok,
    `post-login /me failed: HTTP ${me.status}${me.errorMessage ? ' — ' + me.errorMessage : ''}`,
  );
  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    role: me.body.role,
    email: me.body.email,
  };
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
        `expected login to fail with wrong password, got HTTP ${res.status}`,
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
          `expected admin refresh token to be rejected by customer /auth/refresh, got HTTP ${res.status}`,
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
        `expected the logged-out refresh token to be rejected, got HTTP ${reuse.status}`,
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

    let editorProbeId: string | undefined;
    await step('CONTENT_EDITOR can create a Home Hero Card', async () => {
      if (!editorAdmin) throw new Error('no CONTENT_EDITOR session');
      const res = await apiCall<{ id: string }>(
        API_ORIGIN,
        '/api/v1/admin/home/hero-cards',
        {
          method: 'POST',
          token: editorAdmin.accessToken,
          body: JSON.stringify(rbacProbeHeroCard()),
        },
      );
      assert(
        res.ok,
        `expected CONTENT_EDITOR create to succeed, got HTTP ${res.status}`,
      );
      editorProbeId = res.body.id;
    });
    if (editorProbeId) {
      await step('CONTENT_EDITOR can delete a Home Hero Card', async () => {
        const res = await apiCall(
          API_ORIGIN,
          `/api/v1/admin/home/hero-cards/${editorProbeId}`,
          {
            method: 'DELETE',
            token: editorAdmin!.accessToken,
          },
        );
        assert(
          res.ok,
          `expected CONTENT_EDITOR delete to succeed, got HTTP ${res.status}`,
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
        `expected SUPPORT_VIEWER read to succeed, got HTTP ${res.status}`,
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
        assert(res.ok, `expected upload to succeed, got HTTP ${res.status}`);
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
          throw new Error(`cleanup delete failed: HTTP ${res.status}`);
      });
    }

    if (disposableMediaUrl) {
      await step(
        'Uploaded media is retrievable via its public URL',
        async () => {
          const res = await fetch(disposableMediaUrl!);
          assert(
            res.ok,
            `expected public media URL to return 200, got HTTP ${res.status}`,
          );
          const ct = res.headers.get('content-type');
          assert(
            !!ct && ct.startsWith('image/'),
            `expected an image content-type, got ${ct}`,
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
        `expected the magic-byte mismatch to be rejected, got HTTP ${res.status}`,
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

    await crudResourceCheck(
      'hero-cards',
      rbacProbeHeroCard(),
      { title: `${QA_TAG}-updated` },
      superAdmin,
    );
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
    await customerAuthCheck();

    // --- Section 11: Audit log QA -------------------------------------------
    await step(
      "Audit log contains entries for this run's mutations",
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
          `expected audit log read to succeed, got HTTP ${res.status}`,
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
  } catch (fatal) {
    finish(fatal instanceof Error ? fatal : new Error(String(fatal)));
    return;
  }

  finish(null);
}

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
    assert(res.ok, `create failed: HTTP ${res.status}`);
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
        throw new Error(`cleanup delete failed: HTTP ${res.status}`);
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
    assert(put.ok, `update failed: HTTP ${put.status}`);
    const get = await apiCall<Record<string, unknown>>(
      API_ORIGIN,
      `/api/v1/admin/home/${resourcePath}/${id}`,
      {
        token: admin.accessToken,
      },
    );
    assert(get.ok, `re-fetch after update failed: HTTP ${get.status}`);
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
    assert(put.ok, `deactivate failed: HTTP ${put.status}`);
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
      assert(res.ok, `reorder failed: HTTP ${res.status}`);
    },
  );
}

// --- Propagation checks (approved content — snapshot, mutate, verify, restore)

async function propagationTextCheck(admin: AdminSession): Promise<void> {
  const original = await step(
    'Propagation/TEXT: snapshot an approved Hero Card',
    async () => {
      const res = await apiCall<Array<{ id: string; title: string }>>(
        API_ORIGIN,
        '/api/v1/admin/home/hero-cards?limit=1',
        {
          token: admin.accessToken,
        },
      );
      assert(
        res.ok && res.body.length > 0,
        'expected at least one existing hero card',
      );
      return res.body[0];
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
    if (!res.ok) throw new Error(`restore failed: HTTP ${res.status}`);
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
      assert(put.ok, `mutation failed: HTTP ${put.status}`);
      const pub = await apiCall<Array<{ id: string; title: string }>>(
        API_ORIGIN,
        '/api/v1/home/hero-cards',
      );
      assert(pub.ok, `public API read failed: HTTP ${pub.status}`);
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
      assert(put.ok, `restore failed: HTTP ${put.status}`);
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
      const res = await apiCall<
        Array<{ id: string; title: string; active: boolean }>
      >(API_ORIGIN, '/api/v1/admin/home/news-articles?limit=1', {
        token: admin.accessToken,
      });
      assert(
        res.ok && res.body.length > 0,
        'expected at least one existing news article',
      );
      return res.body[0];
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
      if (!res.ok) throw new Error(`restore failed: HTTP ${res.status}`);
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
      assert(put.ok, `deactivate failed: HTTP ${put.status}`);
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
      assert(put.ok, `reactivate failed: HTTP ${put.status}`);
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
      const res = await apiCall<Array<{ id: string; sortOrder: number }>>(
        API_ORIGIN,
        '/api/v1/admin/home/service-mosaic-tiles?limit=100',
        { token: admin.accessToken },
      );
      assert(
        res.ok && res.body.length >= 2,
        'expected at least two mosaic tiles to swap order on',
      );
      return res.body
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
      if (!res.ok) throw new Error(`restore failed: HTTP ${res.status}`);
    },
  );

  const swapped = [...originalOrder];
  [swapped[0], swapped[1]] = [
    { id: swapped[0].id, sortOrder: swapped[1].sortOrder },
    { id: swapped[1].id, sortOrder: swapped[0].sortOrder },
  ];

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
      assert(patch.ok, `reorder failed: HTTP ${patch.status}`);
      const pub = await apiCall<Array<{ id: string }>>(
        API_ORIGIN,
        '/api/v1/home/service-mosaic-tiles',
      );
      assert(pub.ok, `public read failed: HTTP ${pub.status}`);
      assert(
        pub.body[0]?.id === swapped[0].id,
        `expected public order's first item to be ${swapped[0].id}, got ${pub.body[0]?.id}`,
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
      assert(patch.ok, `restore failed: HTTP ${patch.status}`);
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
      const res = await apiCall<
        Array<{ id: string; mediaAssetId: string | null }>
      >(API_ORIGIN, '/api/v1/admin/home/service-banners?limit=1', {
        token: admin.accessToken,
      });
      assert(
        res.ok && res.body.length > 0,
        'expected at least one existing service banner',
      );
      return res.body[0];
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
      assert(res.ok, `upload failed: HTTP ${res.status}`);
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
      if (!res.ok) throw new Error(`restore failed: HTTP ${res.status}`);
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
        throw new Error(`cleanup delete failed: HTTP ${res.status}`);
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
      assert(put.ok, `mutation failed: HTTP ${put.status}`);
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
        `expected the new image URL to load, got HTTP ${imgRes.status}`,
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
      assert(put.ok, `restore failed: HTTP ${put.status}`);
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

async function customerAuthCheck(): Promise<void> {
  const verify = await step('Customer STAGING_TEST_AUTH login', async () => {
    const res = await apiCall<
      | { status: 'authenticated'; accessToken: string; refreshToken: string }
      | { status: 'signup_required'; signupToken: string }
    >(API_ORIGIN, '/api/v1/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: '09121111111', code: '123456' }),
    });
    assert(
      res.ok,
      `expected the staging test-auth bypass to succeed — is STAGING_TEST_AUTH=true set on this deployment? HTTP ${res.status}`,
    );
    return res.body;
  });
  if (!verify) {
    skip(
      'Customer authenticated Home access',
      'STAGING_TEST_AUTH login did not succeed',
    );
    return;
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
        assert(res.ok, `signup completion failed: HTTP ${res.status}`);
        customerToken = res.body.accessToken;
      },
    );
  }
  if (!customerToken) {
    skip(
      'Customer authenticated Home access',
      'no customer access token obtained',
    );
    return;
  }

  await step(
    'Customer token is rejected by Admin /auth/me (reverse cross-boundary)',
    async () => {
      const res = await apiCall(API_ORIGIN, '/api/v1/admin/auth/me', {
        token: customerToken,
      });
      assert(
        !res.ok,
        `expected customer token to be rejected on the admin identity boundary, got HTTP ${res.status}`,
      );
    },
  );

  console.log(
    '[qa] note: the STAGING_TEST_AUTH fixed test phone (09121111111) is a permanent, intentional fixture — its User row is left in place, not deleted, matching every other run of this script.',
  );
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
