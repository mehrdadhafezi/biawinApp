/**
 * Stage 5.17-D — executable Home Admin Browser QA verifier (the browser half).
 *
 * Implements the 46-test matrix of docs/STAGE-5.17-C-HOME-ADMIN-BROWSER-QA-PLAN.md
 * with Playwright 1.48.2 (same pinned framework/image as deploy/staging/qa/browser).
 * Run ONLY by `deploy/staging/run-stage-5-17-c-browser-qa.sh`, AFTER
 * `control.js setup` has created the QA fixtures and written `manifest.json`;
 * `control.js teardown` + `verify` always run afterwards (shell trap).
 *
 * Safety model (all of it reuses ./qa-contract — nothing is re-implemented here):
 *   - a context-level MUTATION FIREWALL is registered FIRST on every context, so it is
 *     the LAST route handler to see a request (Playwright runs later-registered routes
 *     first and `route.fallback()` passes down). Every non-GET request is checked with
 *     `decideMutation`; a blocked request is aborted and recorded as a firewall
 *     violation (the running test FAILs, and the run verdict fails).
 *   - per-test stubs (`route.fulfill`) and capture+abort routes are registered on the
 *     PAGE, so they run before the firewall; a stubbed/captured request never reaches
 *     the backend.
 *   - real Hero rows are never mutated (observe / capture+abort / stub only).
 *   - the reorder endpoint is blocked by the firewall unless
 *     STAGE517C_ALLOW_REORDER_METADATA_TOUCH === 'true' (REO-02 is BLOCKED otherwise).
 *   - fixtures created by the UI are registered the instant their creating response
 *     arrives and persisted to dynamic-fixtures.json (control.js teardown reads it).
 *   - screenshots only (named stage517c-<runId>-<TEST-ID>.png); no video, no trace.
 *   - no secret is ever written: credentials come from the environment / a 0600 file,
 *     and every string written passes through `redact()`.
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page, type Route } from 'playwright';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  FixtureBag,
  FixtureRegistry,
  QA_TESTS,
  decideMutation,
  gateTest,
  isUuid,
  makeQaFileName,
  makeQaRun,
  type FixtureType,
  type QaRun,
  type QaTestSpec,
} from './qa-contract';
import {
  RUN_FILES,
  analyzeReorderPayload,
  deriveCapabilities,
  redact,
  screenshotName,
  type BrowserOutcome,
  type FirewallEvent,
  type Manifest,
} from './qa-orchestration';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RUN_DIR = process.env.STAGE517C_RUN_DIR ?? '/run';
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

const manifest = JSON.parse(readFileSync(`${RUN_DIR}/${RUN_FILES.manifest}`, 'utf8')) as Manifest;
const run: QaRun = makeQaRun(manifest.runId);
const ADMIN = manifest.adminOrigin.replace(/\/+$/, '');
const API = manifest.apiOrigin.replace(/\/+$/, '');
const SHOTS = `${RUN_DIR}/${RUN_FILES.screenshotsDir}`;
mkdirSync(SHOTS, { recursive: true });

const roleCreds: Record<string, { email: string; password: string }> = existsSync(`${RUN_DIR}/${RUN_FILES.roles}`)
  ? (JSON.parse(readFileSync(`${RUN_DIR}/${RUN_FILES.roles}`, 'utf8')) as Record<string, { email: string; password: string }>)
  : {};

const secrets = (): string[] => [ADMIN_PASSWORD ?? '', ...Object.values(roleCreds).map((c) => c.password)];
const clean = (s: string): string => redact(s, secrets());
const log = (msg: string): void => console.log(`[stage-5.17-c:browser] ${clean(msg)}`);

// Registry + bag are rebuilt from the manifest (control.js already registered these ids in state.json).
const registry = new FixtureRegistry();
const bag = new FixtureBag();
for (const f of manifest.fixtures) {
  registry.register(f.name, f.type, f.id, f.marker);
  bag.set(f.name, f.id);
}
const fx = (name: string): { id: string; marker: string; bodySlug?: string } => {
  const f = manifest.fixtures.find((x) => x.name === name);
  if (!f) throw new Error(`fixture ${name} is not available`);
  return f;
};
const capabilities = deriveCapabilities({ allowReorderMetadataTouch: manifest.allowReorderMetadataTouch, availableRoles: manifest.availableRoles });

const firewallEvents: FirewallEvent[] = [];
let currentTest = '(setup)';
let blockedThisTest: string[] = [];
let pageErrorsThisTest: string[] = [];

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

class Skip extends Error {
  constructor(
    readonly status: 'NOT_RUN' | 'BLOCKED',
    message: string,
  ) {
    super(message);
  }
}

function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PERSIAN = /[؀-ۿ]/;
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function persistDynamic(entry: { name: string; type: FixtureType; id: string; marker: string }): void {
  appendFileSync(`${RUN_DIR}/${RUN_FILES.dynamicFixtures}`, JSON.stringify(entry) + '\n', 'utf8');
}

/** Registers a fixture created by the UI — persisted BEFORE anything else can fail. */
function registerDynamic(name: string, type: FixtureType, id: string, marker: string): void {
  if (!isUuid(id) || registry.has(type, id)) return;
  registry.register(name, type, id, marker);
  persistDynamic({ name, type, id, marker });
  log(`registered UI-created ${type} ${name}`);
}

const RESOURCE_PATH = {
  news: { api: 'news-articles', list: '/home/news', type: 'news' as FixtureType },
  banner: { api: 'service-banners', list: '/home/service-banners', type: 'banner' as FixtureType },
  mosaic: { api: 'service-mosaic-tiles', list: '/home/service-mosaic', type: 'mosaic' as FixtureType },
  hero: { api: 'hero-cards', list: '/home/hero-cards', type: 'hero' as FixtureType },
};
type Resource = keyof typeof RESOURCE_PATH;

// ---------------------------------------------------------------------------
// Direct API access (READS, and QA-row mutations that pass the same firewall)
// ---------------------------------------------------------------------------

let adminToken = '';

async function apiJson<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T; message?: string }> {
  const upper = method.toUpperCase();
  if (upper !== 'GET') {
    const decision = decideMutation(run, registry, { method: upper, path, body, allowReorderMetadataTouch: manifest.allowReorderMetadataTouch });
    firewallEvents.push({ testId: currentTest, method: upper, path, allowed: decision.allow, reason: `[verifier] ${decision.reason}` });
    if (!decision.allow) {
      blockedThisTest.push(`${upper} ${path}: ${decision.reason}`);
      throw new Error(`verifier refused ${upper} ${path}: ${decision.reason}`);
    }
  }
  const res = await fetch(`${API}${path}`, {
    method: upper,
    headers: { Authorization: `Bearer ${adminToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  return {
    status: res.status,
    data: parsed && parsed.success === true ? parsed.data : parsed,
    message: parsed && parsed.success === false ? String(parsed.error?.message ?? '') : undefined,
  };
}

async function adminLoginApi(): Promise<void> {
  const res = await fetch(`${API}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json: any = await res.json().catch(() => ({}));
  const token = json?.data?.accessToken;
  if (!res.ok || typeof token !== 'string') throw new Error(`API login failed: HTTP ${res.status}`);
  adminToken = token;
}

const adminList = async (r: Resource): Promise<any[]> => {
  const res = await apiJson<{ items: any[] }>('GET', `/api/v1/admin/home/${RESOURCE_PATH[r].api}?limit=100`);
  expect(res.status === 200 && Array.isArray(res.data?.items), `admin list ${r} failed: HTTP ${res.status}`);
  return res.data.items;
};
const adminGet = async (r: Resource, id: string): Promise<{ status: number; item: any }> => {
  const res = await apiJson('GET', `/api/v1/admin/home/${RESOURCE_PATH[r].api}/${id}`);
  return { status: res.status, item: res.data };
};

// ---------------------------------------------------------------------------
// Browser plumbing: firewall, contexts, pages
// ---------------------------------------------------------------------------

async function firewall(route: Route): Promise<void> {
  const req = route.request();
  const method = req.method().toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.fallback();
  const url = new URL(req.url());
  const contentType = req.headers()['content-type'] ?? '';
  let body: unknown;
  if (contentType.includes('json')) {
    try {
      body = req.postDataJSON();
    } catch {
      body = undefined;
    }
  }
  let decision = decideMutation(run, registry, { method, path: url.pathname, body, allowReorderMetadataTouch: manifest.allowReorderMetadataTouch });
  if (decision.allow && method === 'POST' && url.pathname.endsWith('/admin/media/upload')) {
    const raw = req.postDataBuffer()?.toString('latin1') ?? '';
    if (!raw.includes(`filename="${run.tag}`)) decision = { allow: false, reason: "media upload file name does not carry this run's QA tag" };
  }
  firewallEvents.push({ testId: currentTest, method, path: url.pathname, allowed: decision.allow, reason: decision.reason });
  if (!decision.allow) {
    blockedThisTest.push(`${method} ${url.pathname}: ${decision.reason}`);
    log(`FIREWALL BLOCKED [${currentTest}] ${method} ${url.pathname} — ${decision.reason}`);
    return route.abort('blockedbyclient');
  }
  return route.fallback();
}

const contexts: BrowserContext[] = [];

async function newContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fa-IR' });
  context.setDefaultTimeout(20_000);
  await context.route('**/api/v1/**', firewall); // registered FIRST => runs LAST
  contexts.push(context);
  return context;
}

async function loginUi(context: BrowserContext, email: string, password: string): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(`${ADMIN}/login`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود', exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  } finally {
    await page.close();
  }
}

/** A page whose UI-created rows/media are registered the moment the creating response arrives. */
async function openPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrorsThisTest.push(clean(err.message)));
  page.on('response', (res) => {
    const req = res.request();
    if (req.method() !== 'POST' || !res.ok()) return;
    const path = new URL(res.url()).pathname;
    const home = /\/admin\/home\/(news-articles|service-banners|service-mosaic-tiles|hero-cards)$/.exec(path);
    const isUpload = path.endsWith('/admin/media/upload');
    if (!home && !isUpload) return;
    void res
      .json()
      .then((json: any) => {
        const id = json?.data?.id;
        if (home) {
          const type = home[1] === 'news-articles' ? 'news' : home[1] === 'service-banners' ? 'banner' : home[1] === 'service-mosaic-tiles' ? 'mosaic' : 'hero';
          registerDynamic(`ui-${type}`, type, id, String(json?.data?.title ?? json?.data?.kicker ?? run.tag));
        } else registerDynamic('ui-media', 'media', id, String(json?.data?.fileName ?? run.tag));
      })
      .catch(() => undefined);
  });
  return page;
}

// ---------------------------------------------------------------------------
// Request capture / stubs
// ---------------------------------------------------------------------------

interface Capture {
  count: number;
  bodies: any[];
}

/** Records matching requests and ABORTS them — nothing reaches the backend. */
async function captureAndAbort(page: Page, method: string, pattern: RegExp): Promise<Capture> {
  const cap: Capture = { count: 0, bodies: [] };
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    if (req.method() === method && pattern.test(new URL(req.url()).pathname)) {
      cap.count += 1;
      try {
        cap.bodies.push(req.postDataJSON());
      } catch {
        cap.bodies.push(null);
      }
      return route.abort('aborted');
    }
    return route.fallback();
  });
  return cap;
}

/** Fulfils matching requests with a fixed error envelope — nothing reaches the backend. */
async function stubError(page: Page, method: string, pattern: RegExp, status: number, message: string, details?: unknown): Promise<Capture> {
  const cap: Capture = { count: 0, bodies: [] };
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    if (req.method() === method && pattern.test(new URL(req.url()).pathname)) {
      cap.count += 1;
      try {
        cap.bodies.push(req.postDataJSON());
      } catch {
        cap.bodies.push(null);
      }
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: `STUB_${status}`, message, ...(details ? { details } : {}) } }),
      });
    }
    return route.fallback();
  });
  return cap;
}

/** Passes everything through but counts non-GET requests (and keeps their bodies). */
function watchMutations(page: Page): Capture & { methods: string[]; paths: string[] } {
  const cap = { count: 0, bodies: [] as any[], methods: [] as string[], paths: [] as string[] };
  page.on('request', (req) => {
    const method = req.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (!req.url().includes('/api/v1/')) return;
    cap.count += 1;
    cap.methods.push(method);
    cap.paths.push(new URL(req.url()).pathname);
    try {
      cap.bodies.push(req.postDataJSON());
    } catch {
      cap.bodies.push(null);
    }
  });
  return cap;
}

// ---------------------------------------------------------------------------
// UI helpers (selectors are grounded in the real components — see comments)
// ---------------------------------------------------------------------------

/** FormField.tsx: <label class=biawin-form-field><span class=biawin-form-field-label>LABEL *</span> control … */
function field(page: Page, label: string): Locator {
  return page
    .locator('label.biawin-form-field', { has: page.locator('span.biawin-form-field-label', { hasText: new RegExp(`^${esc(label)}\\s*\\*?$`) }) })
    .locator('input, textarea, select')
    .first();
}
function fieldError(page: Page, label: string): Locator {
  return page
    .locator('label.biawin-form-field', { has: page.locator('span.biawin-form-field-label', { hasText: new RegExp(`^${esc(label)}\\s*\\*?$`) }) })
    .locator('span.biawin-form-field-error');
}

async function waitLoaded(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.getByText('در حال بارگذاری…').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
}

async function openList(page: Page, r: Resource): Promise<void> {
  await page.goto(`${ADMIN}${RESOURCE_PATH[r].list}`);
  await waitLoaded(page);
  await page.locator('table.biawin-home-list-table, h1').first().waitFor();
}

const rowOf = (page: Page, text: string): Locator => page.locator('table.biawin-home-list-table tbody tr', { hasText: text });

async function untickActive(page: Page): Promise<void> {
  const box = page.getByLabel('فعال', { exact: true });
  if (await box.isChecked()) await box.uncheck();
}

async function submitForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
}

/** Opens the picker, pages through it until the named asset is found, selects it. */
async function pickMedia(page: Page, fileName: string): Promise<void> {
  await page.getByRole('button', { name: /^(انتخاب تصویر|تغییر تصویر|انتخاب تصویر جایگزین)$/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  for (let i = 0; i < 12; i++) {
    await dialog.getByText('در حال بارگذاری…').waitFor({ state: 'hidden' }).catch(() => undefined);
    const item = dialog.locator('button.biawin-media-picker-item', { hasText: fileName });
    if ((await item.count()) > 0) {
      await item.first().click();
      await dialog.waitFor({ state: 'hidden' });
      return;
    }
    const next = dialog.getByRole('button', { name: 'بعدی', exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  throw new Error(`asset ${fileName} was not found in the media picker`);
}

async function selectCategory(page: Page, categoryId: string): Promise<void> {
  const select = field(page, 'دسته‌بندی');
  await page.waitForFunction((el) => (el as HTMLSelectElement).options.length > 1, await select.elementHandle());
  await select.selectOption(categoryId);
}

async function expectAlert(page: Page, needle: string | RegExp, scope?: Locator): Promise<string> {
  const alerts = (scope ?? page).getByRole('alert');
  await alerts.filter({ hasText: needle }).first().waitFor({ timeout: 15_000 });
  return clean((await alerts.filter({ hasText: needle }).first().innerText()).slice(0, 300));
}

async function waitList(page: Page, r: Resource): Promise<void> {
  await page.waitForURL(new RegExp(`${esc(RESOURCE_PATH[r].list)}/?$`), { timeout: 30_000 });
  await waitLoaded(page);
}

const taggedText = (suffix: string): string => `${run.tag} ${suffix}`;

async function createdId(page: Page, r: Resource, click: () => Promise<void>): Promise<string> {
  const [res] = await Promise.all([
    page.waitForResponse((x) => x.request().method() === 'POST' && x.url().endsWith(`/admin/home/${RESOURCE_PATH[r].api}`), { timeout: 30_000 }),
    click(),
  ]);
  expect(res.ok(), `create ${r} failed: HTTP ${res.status()}`);
  const json: any = await res.json();
  expect(isUuid(json?.data?.id), `create ${r} returned no uuid`);
  registerDynamic(`ui-${r}`, RESOURCE_PATH[r].type, json.data.id, taggedText(r));
  return json.data.id as string;
}

async function saveEdit(page: Page, r: Resource, id: string): Promise<void> {
  const [res] = await Promise.all([
    page.waitForResponse((x) => x.request().method() === 'PUT' && x.url().endsWith(`/admin/home/${RESOURCE_PATH[r].api}/${id}`), { timeout: 30_000 }),
    submitForm(page),
  ]);
  expect(res.ok(), `save ${r} ${id} failed: HTTP ${res.status()}`);
  await waitList(page, r);
}

async function openEdit(page: Page, r: Resource, id: string): Promise<void> {
  await page.goto(`${ADMIN}${RESOURCE_PATH[r].list}/${id}`);
  await waitLoaded(page);
  await page.locator('form.biawin-home-form').waitFor();
}

async function noConsoleErrors(): Promise<void> {
  expect(pageErrorsThisTest.length === 0, `uncaught page error(s): ${pageErrorsThisTest.slice(0, 2).join(' | ')}`);
}

async function mediaPageLoad(page: Page): Promise<void> {
  await page.goto(`${ADMIN}/media`);
  await waitLoaded(page);
  await page.locator('h1', { hasText: 'کتابخانه رسانه' }).waitFor();
}

/** Finds a media card by file name, paging forward when needed. */
async function findMediaCard(page: Page, fileName: string): Promise<Locator> {
  for (let i = 0; i < 12; i++) {
    const card = page.locator('li.biawin-media-card', { hasText: fileName });
    if ((await card.count()) > 0) return card.first();
    const next = page.getByRole('navigation', { name: 'صفحه‌بندی رسانه' }).getByRole('button', { name: 'بعدی', exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
    await page.waitForTimeout(600);
  }
  throw new Error(`media card ${fileName} not found`);
}

async function mediaNames(page: Page): Promise<string[]> {
  return page.locator('li.biawin-media-card strong.biawin-media-card-name').allInnerTexts();
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const outcomes: BrowserOutcome[] = [];
const startedAt = new Date().toISOString();
let crashed: string | undefined;

function writeResults(): void {
  const payload = { outcomes, startedAt, endedAt: new Date().toISOString(), crashed };
  writeFileSync(`${RUN_DIR}/${RUN_FILES.browserResults}`, clean(JSON.stringify(payload, null, 2)), 'utf8');
  writeFileSync(`${RUN_DIR}/${RUN_FILES.firewallEvents}`, clean(JSON.stringify(firewallEvents, null, 2)), 'utf8');
}

async function runTest(spec: QaTestSpec, context: () => Promise<BrowserContext>, body: (page: Page) => Promise<Record<string, unknown> | void>): Promise<void> {
  currentTest = spec.id;
  blockedThisTest = [];
  pageErrorsThisTest = [];
  const gate = gateTest(spec, bag, capabilities);
  if (!gate.run) {
    outcomes.push({ ...gate.outcome, klass: spec.klass });
    log(`${gate.outcome.status} ${spec.id} — ${gate.outcome.detail}`);
    writeResults();
    return;
  }
  let page: Page | undefined;
  const outcome: BrowserOutcome = { id: spec.id, klass: spec.klass, status: 'PASS', detail: spec.title, screenshots: [] };
  try {
    page = await openPage(await context());
    outcome.evidence = (await body(page)) ?? undefined;
    if (blockedThisTest.length > 0) {
      outcome.status = 'FAIL';
      outcome.detail = `mutation firewall blocked: ${blockedThisTest.join('; ')}`;
    }
  } catch (err) {
    if (err instanceof Skip) {
      outcome.status = err.status;
      outcome.detail = clean(err.message);
    } else {
      outcome.status = 'FAIL';
      outcome.detail = clean(err instanceof Error ? err.message.split('\n')[0] : String(err));
      if (blockedThisTest.length > 0) outcome.detail += ` | firewall blocked: ${blockedThisTest.join('; ')}`;
    }
  } finally {
    if (page) {
      const name = screenshotName(run.runId, spec.id);
      try {
        await page.screenshot({ path: `${SHOTS}/${name}`, fullPage: false });
        outcome.screenshots = [name];
      } catch {
        /* screenshot is best-effort evidence */
      }
      await page.close().catch(() => undefined);
    }
  }
  outcomes.push(outcome);
  log(`${outcome.status} ${spec.id} — ${outcome.detail}`);
  writeResults(); // persisted after EVERY test — a later crash cannot lose earlier results
}

const spec = (id: string): QaTestSpec => {
  const s = QA_TESTS.find((t) => t.id === id);
  if (!s) throw new Error(`unknown test ${id}`);
  return s;
};

// ===========================================================================
// main
// ===========================================================================

async function main(): Promise<number> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    log('no admin credentials in the environment — every test is BLOCKED');
    return 3;
  }
  await adminLoginApi();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const superCtx = await newContext(browser);
    await loginUi(superCtx, ADMIN_EMAIL, ADMIN_PASSWORD);
    const asSuper = async (): Promise<BrowserContext> => superCtx;

    const roleCtxs = new Map<string, BrowserContext>();
    const asRole = (role: string) => async (): Promise<BrowserContext> => {
      const existing = roleCtxs.get(role);
      if (existing) return existing;
      const creds = roleCreds[role];
      if (!creds) throw new Skip('BLOCKED', `no ${role} account is available`);
      const ctx = await newContext(browser);
      await loginUi(ctx, creds.email, creds.password);
      roleCtxs.set(role, ctx);
      return ctx;
    };

    const cats = manifest.categories;

    // --------------------------------------------------------------- NAV
    await runTest(spec('NAV-01'), asSuper, async (page) => {
      await page.goto(`${ADMIN}/home`);
      await waitLoaded(page);
      for (const label of ['کارت‌های ابتدایی', 'بنرهای خدمات', 'موزاییک خدمات', 'اخبار']) {
        await page.locator('a.biawin-home-overview-link', { hasText: label }).first().waitFor();
      }
      expect((await page.locator('a.biawin-home-overview-link').count()) === 4, 'overview does not list exactly 4 resources');
      expect((await page.getByRole('alert').count()) === 0, 'overview shows an error');
      const stats = await page.locator('.biawin-home-overview-stats').allInnerTexts();
      expect(stats.every((t) => /کل/.test(t)), 'a resource card has no total');
      await noConsoleErrors();
      return { resources: 4 };
    });

    await runTest(spec('NAV-02'), asSuper, async (page) => {
      const evidence: Record<string, unknown> = {};
      for (const r of ['hero', 'banner', 'mosaic', 'news'] as Resource[]) {
        await openList(page, r);
        expect((await page.getByRole('alert').count()) === 0, `${r} list shows an error`);
        const rows = await page.locator('table.biawin-home-list-table tbody tr').count();
        const empty = await page.getByText(/هنوز/).count();
        expect(rows > 0 || empty > 0, `${r} list rendered neither rows nor the empty state`);
        const broken = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.biawin-home-list-thumb img')).filter((i) => {
            const img = i as HTMLImageElement;
            return img.style.display !== 'none' && img.complete && img.naturalWidth === 0;
          }).length,
        );
        evidence[r] = { rows, brokenVisibleImages: broken };
      }
      await noConsoleErrors();
      return evidence;
    });

    // --------------------------------------------------------------- HERO
    await runTest(spec('HERO-01'), asSuper, async (page) => {
      const cap = watchMutations(page);
      await page.goto(`${ADMIN}${RESOURCE_PATH.hero.list}/new`);
      await waitLoaded(page);
      const exhausted = page.locator('.biawin-hero-keys-exhausted');
      await exhausted.waitFor({ timeout: 15_000 }).catch(() => undefined);
      if ((await exhausted.count()) === 0) throw new Error('the "all keys used" state is not shown (fewer than 3 Hero keys occupied, or the page did not render it)');
      const submit = page.getByRole('button', { name: 'ذخیره', exact: true });
      expect(await submit.isDisabled(), 'submit is not disabled in the all-keys-used state');
      expect(cap.count === 0, 'a mutating request was sent');
      return { exhausted: true, submitDisabled: true };
    });

    await runTest(spec('HERO-02'), asSuper, async (page) => {
      const cap = await captureAndAbort(page, 'PUT', /\/admin\/home\/hero-cards\//);
      await openList(page, 'hero');
      const first = page.locator('table.biawin-home-list-table tbody tr .biawin-home-list-title a').first();
      expect((await first.count()) > 0, 'no real Hero row to open');
      await first.click();
      await page.locator('form.biawin-home-form').waitFor();
      await field(page, 'برچسب').fill('');
      await field(page, 'عنوان').fill('x'.repeat(201));
      await submitForm(page);
      await fieldError(page, 'برچسب').first().waitFor();
      await fieldError(page, 'عنوان').first().waitFor();
      const long = clean(await fieldError(page, 'عنوان').first().innerText());
      expect(/200/.test(long), 'over-long title error does not mention the 200 limit');
      expect(cap.count === 0, `${cap.count} request(s) were sent by an invalid Hero form`);
      return { requests: cap.count };
    });

    await runTest(spec('HERO-03'), asSuper, async (page) => {
      const message = 'این کلید کارت قبلاً استفاده شده است.';
      const cap = await stubError(page, 'PUT', /\/admin\/home\/hero-cards\//, 409, message);
      await openList(page, 'hero');
      await page.locator('table.biawin-home-list-table tbody tr .biawin-home-list-title a').first().click();
      await page.locator('form.biawin-home-form').waitFor();
      await submitForm(page); // real row unchanged — the request is stubbed and never leaves the browser
      const shown = await expectAlert(page, 'کلید کارت');
      expect(cap.count === 1, `expected 1 stubbed request, saw ${cap.count}`);
      return { stubbed: true, shown };
    });

    // --------------------------------------------------------------- BANNERS
    await runTest(spec('BAN-01'), asSuper, async (page) => {
      const cap = await captureAndAbort(page, 'POST', /\/admin\/home\/service-banners$/);
      await page.goto(`${ADMIN}${RESOURCE_PATH.banner.list}/new`);
      await waitLoaded(page);
      await untickActive(page);
      await submitForm(page);
      await fieldError(page, 'دسته‌بندی').first().waitFor();
      await fieldError(page, 'متن کوتاه (kicker)').first().waitFor();
      if (cats.activeId) await selectCategory(page, cats.activeId);
      await field(page, 'متن کوتاه (kicker)').fill(taggedText('k').padEnd(201, 'x'));
      await submitForm(page);
      const msg = await fieldError(page, 'متن کوتاه (kicker)').first().innerText();
      expect(/200/.test(msg), 'kicker limit message does not mention 200');
      expect(cap.count === 0, `${cap.count} request(s) sent by an invalid form`);
      return { requests: 0 };
    });

    await runTest(spec('BAN-02'), asSuper, async (page) => {
      expect(cats.activeId, 'no active category exists');
      await page.goto(`${ADMIN}${RESOURCE_PATH.banner.list}/new`);
      await waitLoaded(page);
      await selectCategory(page, cats.activeId);
      await field(page, 'متن کوتاه (kicker)').fill(taggedText('bannerUi'));
      await pickMedia(page, fx('mediaB').marker);
      await untickActive(page);
      const id = await createdId(page, 'banner', () => submitForm(page));
      bag.set('uiBanner', id);
      await waitList(page, 'banner');
      await rowOf(page, taggedText('bannerUi')).first().waitFor();
      const { item } = await adminGet('banner', id);
      expect(item.mediaAssetId === fx('mediaB').id, 'banner.mediaAssetId is not media B');
      expect(item.categoryId === cats.activeId && item.active === false, 'banner category/active state is wrong');
      return { id, active: item.active };
    });

    await runTest(spec('BAN-03'), asSuper, async (page) => {
      const b = fx('bannerInactiveCat');
      await openEdit(page, 'banner', b.id);
      const info = await page.evaluate(() => {
        const s = document.querySelector('.biawin-category-select select') as HTMLSelectElement;
        return { value: s.value, label: s.selectedOptions[0]?.textContent ?? '' };
      });
      expect(info.value === cats.inactiveId, 'the select does not hold the inactive category id');
      expect(/غیرفعال/.test(info.label), `the inactive category is not shown as "(غیرفعال)" (shows "${info.label}")`);
      await field(page, 'متن کوتاه (kicker)').fill(`${b.marker} edited`);
      await saveEdit(page, 'banner', b.id);
      const { item } = await adminGet('banner', b.id);
      expect(item.categoryId === cats.inactiveId, 'the category id changed after save');
      return { shown: info.label };
    });

    await runTest(spec('BAN-04'), asSuper, async (page) => {
      const b = fx('bannerMediaA');
      await openEdit(page, 'banner', b.id);
      await pickMedia(page, fx('mediaB').marker);
      await saveEdit(page, 'banner', b.id);
      expect((await adminGet('banner', b.id)).item.mediaAssetId === fx('mediaB').id, 'replace did not persist media B');
      await openEdit(page, 'banner', b.id);
      await page.getByRole('button', { name: 'حذف انتخاب', exact: true }).click();
      await saveEdit(page, 'banner', b.id);
      expect((await adminGet('banner', b.id)).item.mediaAssetId === null, 'clear did not persist null');
      return { replaced: true, cleared: true };
    });

    await runTest(spec('BAN-05'), asSuper, async (page) => {
      expect(cats.inactiveId, 'no inactive category exists');
      const real = (await adminList('banner')).find((x) => x.categoryId === cats.inactiveId && !String(x.kicker).includes(run.tag));
      if (!real) throw new Skip('NOT_RUN', 'no real banner references the inactive category — nothing to observe');
      const cap = await captureAndAbort(page, 'PUT', /\/admin\/home\/service-banners\//);
      await openEdit(page, 'banner', real.id);
      const info = await page.evaluate(() => {
        const s = document.querySelector('.biawin-category-select select') as HTMLSelectElement;
        return { value: s.value, label: s.selectedOptions[0]?.textContent ?? '' };
      });
      expect(info.value === cats.inactiveId && !/انتخاب کنید/.test(info.label), `select shows "${info.label}" instead of the real (inactive) category`);
      expect(cap.count === 0, 'a request was sent while only observing');
      return { label: info.label, saved: false };
    });

    await runTest(spec('BAN-06'), asSuper, async (page) => {
      expect(cats.activeId, 'no active category exists');
      const cap = await stubError(page, 'POST', /\/admin\/home\/service-banners$/, 422, 'دسته‌بندی انتخاب‌شده معتبر نیست.');
      await page.goto(`${ADMIN}${RESOURCE_PATH.banner.list}/new`);
      await waitLoaded(page);
      await selectCategory(page, cats.activeId);
      await field(page, 'متن کوتاه (kicker)').fill(taggedText('ban422'));
      await untickActive(page);
      await submitForm(page);
      const shown = await expectAlert(page, 'دسته‌بندی انتخاب‌شده معتبر نیست.');
      expect(cap.count === 1, `expected 1 stubbed request, saw ${cap.count}`);
      return { shown };
    });

    await runTest(spec('BAN-07'), asSuper, async (page) => {
      const b = fx('bannerToggle');
      const cap = await captureAndAbort(page, 'PUT', new RegExp(`/admin/home/service-banners/${b.id}$`));
      await openList(page, 'banner');
      await rowOf(page, b.marker).locator('button.biawin-active-toggle').click();
      await expectAlert(page, /./);
      expect(cap.count === 1 && cap.bodies[0]?.active === true, `toggle payload not captured as {active:true} (${JSON.stringify(cap.bodies[0])})`);
      expect((await adminGet('banner', b.id)).item.active === false, 'the QA banner was made public');
      // Now the real delete of the QA banner (a fresh page state, no capture route).
      await page.unroute('**/api/v1/**');
      await openList(page, 'banner');
      await rowOf(page, b.marker).locator('button.biawin-home-list-delete').click();
      await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click();
      await rowOf(page, b.marker).waitFor({ state: 'detached' });
      expect((await adminGet('banner', b.id)).status === 404, 'the QA banner still exists after delete');
      return { captured: cap.bodies[0], deleted: true };
    });

    // --------------------------------------------------------------- MOSAIC
    await runTest(spec('MOS-01'), asSuper, async (page) => {
      expect(cats.activeId, 'no active category exists');
      const make = async (slot: 'half' | 'wide', title: string, lead: string, suffix: string): Promise<any> => {
        await page.goto(`${ADMIN}${RESOURCE_PATH.mosaic.list}/new`);
        await waitLoaded(page);
        await selectCategory(page, cats.activeId!);
        await field(page, 'نوع جایگاه').selectOption(slot);
        await field(page, 'متن کوتاه (kicker)').fill(taggedText(suffix));
        await field(page, 'عنوان').fill(title);
        await field(page, 'توضیح').fill(lead);
        await untickActive(page);
        const id = await createdId(page, 'mosaic', () => submitForm(page));
        return (await adminGet('mosaic', id)).item;
      };
      const half = await make('half', '', '', 'mosHalf');
      expect(half.slotType === 'half' && half.title === null && half.lead === null && half.active === false, `half tile wrong: ${JSON.stringify({ t: half.title, l: half.lead, a: half.active })}`);
      const wide = await make('wide', taggedText('wideTitle'), taggedText('wideLead'), 'mosWide');
      expect(wide.slotType === 'wide' && typeof wide.title === 'string' && typeof wide.lead === 'string', 'wide tile title/lead were not saved');
      return { half: half.id, wide: wide.id };
    });

    await runTest(spec('MOS-02'), asSuper, async (page) => {
      expect(cats.activeId, 'no active category exists');
      const cap = await captureAndAbort(page, 'POST', /\/admin\/home\/service-mosaic-tiles$/);
      await page.goto(`${ADMIN}${RESOURCE_PATH.mosaic.list}/new`);
      await waitLoaded(page);
      await untickActive(page);
      await submitForm(page);
      await fieldError(page, 'متن کوتاه (kicker)').first().waitFor();
      await fieldError(page, 'دسته‌بندی').first().waitFor();
      await selectCategory(page, cats.activeId);
      await field(page, 'متن کوتاه (kicker)').fill('k'.repeat(201));
      await field(page, 'عنوان').fill('t'.repeat(201));
      await field(page, 'توضیح').fill('l'.repeat(501));
      await submitForm(page);
      const k = await fieldError(page, 'متن کوتاه (kicker)').first().innerText();
      const t = await fieldError(page, 'عنوان').first().innerText();
      const l = await fieldError(page, 'توضیح').first().innerText();
      expect(/200/.test(k) && /200/.test(t) && /500/.test(l), `limit messages wrong: ${k} | ${t} | ${l}`);
      expect(cap.count === 0, `${cap.count} request(s) sent by an invalid form`);
      return { requests: 0 };
    });

    await runTest(spec('MOS-03'), asSuper, async (page) => {
      const m = fx('mosaicWide');
      await openEdit(page, 'mosaic', m.id);
      await pickMedia(page, fx('mediaB').marker);
      await field(page, 'متن کوتاه (kicker)').fill(`${m.marker} edited`);
      await saveEdit(page, 'mosaic', m.id);
      let item = (await adminGet('mosaic', m.id)).item;
      expect(item.mediaAssetId === fx('mediaB').id && item.categoryId === cats.activeId, 'replace/category state wrong after save');
      await openEdit(page, 'mosaic', m.id);
      await page.getByRole('button', { name: 'حذف انتخاب', exact: true }).click();
      await saveEdit(page, 'mosaic', m.id);
      item = (await adminGet('mosaic', m.id)).item;
      expect(item.mediaAssetId === null, 'clear did not persist null');
      return { ok: true };
    });

    // --------------------------------------------------------------- NEWS
    const newsCreateForm = async (page: Page, suffix: string, slug?: string): Promise<void> => {
      await page.goto(`${ADMIN}${RESOURCE_PATH.news.list}/new`);
      await waitLoaded(page);
      await field(page, 'دسته‌بندی خبر').fill(run.tag);
      await field(page, 'متن کوتاه (kicker)').fill(taggedText(`${suffix}K`));
      await field(page, 'عنوان').fill(taggedText(suffix));
      await field(page, 'متن مقدمه').fill(taggedText(`${suffix}L`));
      if (slug !== undefined) await field(page, 'شناسه لینک مقاله (bodySlug)').fill(slug);
      await untickActive(page);
    };

    await runTest(spec('NEWS-01'), asSuper, async (page) => {
      const cap = await captureAndAbort(page, 'POST', /\/admin\/home\/news-articles$/);
      await page.goto(`${ADMIN}${RESOURCE_PATH.news.list}/new`);
      await waitLoaded(page);
      await untickActive(page);
      await submitForm(page);
      for (const l of ['دسته‌بندی خبر', 'متن کوتاه (kicker)', 'عنوان', 'متن مقدمه']) await fieldError(page, l).first().waitFor();
      await field(page, 'دسته‌بندی خبر').fill('c'.repeat(101));
      await field(page, 'متن کوتاه (kicker)').fill('k'.repeat(201));
      await field(page, 'عنوان').fill('t'.repeat(301));
      await field(page, 'متن مقدمه').fill('l'.repeat(1001));
      await submitForm(page);
      const limits: Array<[string, string]> = [['دسته‌بندی خبر', '100'], ['متن کوتاه (kicker)', '200'], ['عنوان', '300'], ['متن مقدمه', '1000']];
      for (const [l, n] of limits) {
        const msg = await fieldError(page, l).first().innerText();
        expect(msg.includes(n), `${l}: limit message does not mention ${n} ("${msg}")`);
      }
      expect(cap.count === 0, `${cap.count} request(s) sent by an invalid form`);
      return { requests: 0 };
    });

    await runTest(spec('NEWS-02'), asSuper, async (page) => {
      const cap = await captureAndAbort(page, 'POST', /\/admin\/home\/news-articles$/);
      const bad = ['has space', 'UPPER', 'under_score', 'dou--ble', 'a'.repeat(101)];
      for (const slug of bad) {
        await newsCreateForm(page, 'slugBad', slug);
        await submitForm(page);
        const msg = await fieldError(page, 'شناسه لینک مقاله (bodySlug)').first().innerText();
        expect(PERSIAN.test(msg), `slug "${slug.slice(0, 12)}": message is not Persian`);
      }
      expect(cap.count === 0, `${cap.count} request(s) sent for an invalid slug`);
      return { rejected: bad.length, requests: 0 };
    });

    await runTest(spec('NEWS-03'), asSuper, async (page) => {
      await newsCreateForm(page, 'slugOk', manifest.slugs.valid);
      const id = await createdId(page, 'news', () => submitForm(page));
      expect((await adminGet('news', id)).item.bodySlug === manifest.slugs.valid, 'valid slug was not saved');
      await newsCreateForm(page, 'slugDup', fx('newsSlugOwner').bodySlug);
      await submitForm(page);
      const shown = await expectAlert(page, PERSIAN);
      expect(!/(Unique constraint|Prisma)/i.test(shown), 'the duplicate-slug message leaks internals');
      return { created: id, duplicateMessage: shown };
    });

    await runTest(spec('NEWS-04'), asSuper, async (page) => {
      const watch = watchMutations(page);
      await newsCreateForm(page, 'withMedia');
      await page.getByRole('button', { name: 'انتخاب تصویر', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'آپلود تصویر جدید', exact: true }).click();
      await dialog.locator('input[type="file"]').setInputFiles({ name: makeQaFileName(run, 'uinews'), mimeType: 'image/png', buffer: PNG_1X1 });
      await dialog.getByRole('button', { name: 'آپلود', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 30_000 });
      expect(!watch.paths.some((p) => p.endsWith('/news-articles')), 'the picker upload submitted the OUTER form (Stage 5.20 regression)');
      const id = await createdId(page, 'news', () => submitForm(page));
      const { item } = await adminGet('news', id);
      expect(isUuid(item.mediaAssetId) && item.image, 'the uploaded media is not attached');
      return { created: id, uploads: watch.paths.filter((p) => p.endsWith('/media/upload')).length };
    });

    await runTest(spec('NEWS-05'), asSuper, async (page) => {
      const n = fx('newsMediaA');
      await openEdit(page, 'news', n.id);
      await field(page, 'عنوان').fill(`${n.marker} edited`);
      await pickMedia(page, fx('mediaB').marker);
      await saveEdit(page, 'news', n.id);
      expect((await adminGet('news', n.id)).item.mediaAssetId === fx('mediaB').id, 'replace did not persist media B');
      await openEdit(page, 'news', n.id);
      await page.getByRole('button', { name: 'حذف انتخاب', exact: true }).click();
      await saveEdit(page, 'news', n.id);
      expect((await adminGet('news', n.id)).item.mediaAssetId === null, 'clear did not persist null');
      // restore the reference to media A so MED-06/MED-08 still have a referenced asset
      await openEdit(page, 'news', n.id);
      await pickMedia(page, fx('mediaA').marker);
      await saveEdit(page, 'news', n.id);
      expect((await adminGet('news', n.id)).item.mediaAssetId === fx('mediaA').id, 'media A reference was not restored');
      return { ok: true };
    });

    await runTest(spec('NEWS-06'), asSuper, async (page) => {
      const cap = await stubError(page, 'POST', /\/admin\/home\/news-articles$/, 422, 'رسانه انتخاب‌شده معتبر نیست.');
      await newsCreateForm(page, 'news422');
      await submitForm(page);
      const shown = await expectAlert(page, 'رسانه انتخاب‌شده معتبر نیست.');
      expect(cap.count === 1, `expected 1 stubbed request, saw ${cap.count}`);
      return { shown };
    });

    // --------------------------------------------------------------- SOFT-DELETED MEDIA
    const expectLegacyWarning = async (page: Page): Promise<void> => {
      await page.getByRole('alert').filter({ hasText: 'تصویر قبلی در دسترس نیست' }).first().waitFor();
      await page.getByRole('button', { name: 'انتخاب تصویر جایگزین', exact: true }).waitFor();
      await page.getByRole('button', { name: 'پاک‌کردن مرجع تصویر', exact: true }).waitFor();
      expect((await page.locator('.biawin-media-picker-field-preview img').count()) === 0, 'a substitute image is shown for the unavailable reference');
    };

    await runTest(spec('SDM-01'), asSuper, async (page) => {
      await openEdit(page, 'news', fx('newsLegacyReplace').id);
      await expectLegacyWarning(page);
      return { warning: true };
    });

    await runTest(spec('SDM-02'), asSuper, async (page) => {
      const n = fx('newsLegacyReplace');
      await openEdit(page, 'news', n.id);
      await pickMedia(page, fx('mediaB').marker);
      await saveEdit(page, 'news', n.id);
      expect((await adminGet('news', n.id)).item.mediaAssetId === fx('mediaB').id, 'replace did not persist media B');
      return { ok: true };
    });

    await runTest(spec('SDM-03'), asSuper, async (page) => {
      const n = fx('newsLegacyClear');
      await openEdit(page, 'news', n.id);
      await page.getByRole('button', { name: 'پاک‌کردن مرجع تصویر', exact: true }).click();
      await saveEdit(page, 'news', n.id);
      expect((await adminGet('news', n.id)).item.mediaAssetId === null, 'clear did not persist null');
      return { ok: true };
    });

    await runTest(spec('SDM-04'), asSuper, async (page) => {
      const n = fx('newsLegacyKeep');
      const watch = watchMutations(page);
      await openEdit(page, 'news', n.id);
      await field(page, 'عنوان').fill(`${n.marker} edited`);
      await saveEdit(page, 'news', n.id);
      const put = watch.bodies.find((b) => b && typeof b === 'object');
      expect(put && !('mediaAssetId' in put), 'the PUT body re-sent mediaAssetId for an unresolved reference');
      expect((await adminGet('news', n.id)).item.mediaAssetId === fx('mediaC').id, 'media C reference was rewritten');
      return { putOmitsMediaAssetId: true };
    });

    await runTest(spec('SDM-05'), asSuper, async (page) => {
      const b = fx('bannerLegacy');
      await openEdit(page, 'banner', b.id);
      await expectLegacyWarning(page);
      await pickMedia(page, fx('mediaB').marker);
      await saveEdit(page, 'banner', b.id);
      expect((await adminGet('banner', b.id)).item.mediaAssetId === fx('mediaB').id, 'replace did not persist media B');
      return { ok: true };
    });

    // --------------------------------------------------------------- MEDIA LIBRARY
    const pager = (page: Page): Locator => page.getByRole('navigation', { name: 'صفحه‌بندی رسانه' });
    const apiMediaTotal = async (): Promise<number> => {
      const res = await apiJson<{ total: number }>('GET', '/api/v1/admin/media?page=1&limit=1');
      expect(res.status === 200, `media list API failed: HTTP ${res.status}`);
      return res.data.total;
    };

    await runTest(spec('MED-01'), asSuper, async (page) => {
      await mediaPageLoad(page);
      const total = await apiMediaTotal();
      const hasPager = (await pager(page).count()) > 0;
      if (total > 50) {
        expect(hasPager, `total is ${total} (> 50) but no pager is shown`);
        const text = await pager(page).innerText();
        expect(text.includes(String(total)), `pager "${text.replace(/\s+/g, ' ')}" does not show the API total ${total}`);
      } else expect(!hasPager, 'a pager is shown although everything fits on one page');
      return { total, pager: hasPager };
    });

    await runTest(spec('MED-02'), asSuper, async (page) => {
      await mediaPageLoad(page);
      if ((await pager(page).count()) === 0) throw new Skip('NOT_RUN', 'the active library fits on one page — pagination cannot be exercised');
      const first = await mediaNames(page);
      await pager(page).getByRole('button', { name: 'بعدی', exact: true }).click();
      await pager(page).getByText(/صفحه 2 از/).waitFor();
      const second = await mediaNames(page);
      expect(second.length > 0 && !second.some((n) => first.includes(n)), 'page 2 repeats assets of page 1');
      await pager(page).getByRole('button', { name: 'قبلی', exact: true }).click();
      await pager(page).getByText(/صفحه 1 از/).waitFor();
      expect(JSON.stringify(await mediaNames(page)) === JSON.stringify(first), 'previous page did not restore page 1');
      const total = await apiMediaTotal();
      expect((await pager(page).innerText()).includes(String(total)), 'pager total differs from the API total');
      return { page1: first.length, page2: second.length, total };
    });

    await runTest(spec('MED-03'), asSuper, async (page) => {
      const watch = watchMutations(page);
      await page.goto(`${ADMIN}${RESOURCE_PATH.news.list}/new`);
      await waitLoaded(page);
      await page.getByRole('button', { name: 'انتخاب تصویر', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('button.biawin-media-picker-item').first().waitFor();
      let paged = false;
      const next = dialog.getByRole('button', { name: 'بعدی', exact: true });
      if ((await next.count()) > 0 && !(await next.isDisabled())) {
        const before = await dialog.locator('.biawin-media-picker-item-name').allInnerTexts();
        await next.click();
        await dialog.getByText(/صفحه 2 از/).waitFor();
        const after = await dialog.locator('.biawin-media-picker-item-name').allInnerTexts();
        expect(after.length > 0 && !after.some((n) => before.includes(n)), 'picker page 2 repeats page 1');
        paged = true;
      }
      await dialog.locator('button.biawin-media-picker-item').first().click();
      await dialog.waitFor({ state: 'hidden' });
      expect(watch.count === 0, `selecting an asset sent ${watch.count} write request(s)`);
      return { paged, writes: 0 };
    });

    await runTest(spec('MED-04'), asSuper, async (page) => {
      const d = fx('mediaD');
      const watch = watchMutations(page);
      await mediaPageLoad(page);
      const card = await findMediaCard(page, d.marker);
      await card.getByRole('button', { name: 'حذف', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      expect(watch.count === 0, 'cancelling the confirmation sent a request');
      return { requests: 0 };
    });

    await runTest(spec('MED-05'), asSuper, async (page) => {
      const d = fx('mediaD');
      await mediaPageLoad(page);
      const card = await findMediaCard(page, d.marker);
      await card.getByRole('button', { name: 'حذف', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'فایل حذف شد.' }).waitFor();
      await page.waitForTimeout(500);
      expect((await page.locator('li.biawin-media-card', { hasText: d.marker }).count()) === 0, 'the deleted asset is still listed');
      return { deleted: true };
    });

    const deleteReferencedA = async (page: Page): Promise<string[]> => {
      const a = fx('mediaA');
      const n = fx('newsMediaA');
      if ((await adminGet('news', n.id)).item?.mediaAssetId !== a.id) {
        // precondition repair through the firewall-checked path (QA row -> QA media)
        const fix = await apiJson('PUT', `/api/v1/admin/home/news-articles/${n.id}`, { mediaAssetId: a.id });
        expect(fix.status === 200, `could not restore the media A reference: HTTP ${fix.status}`);
      }
      const watch = watchMutations(page);
      await mediaPageLoad(page);
      const card = await findMediaCard(page, a.marker);
      await card.getByRole('button', { name: 'حذف', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'حذف', exact: true }).click();
      const shown = await expectAlert(page, 'هنوز در حال استفاده است', dialog);
      expect(/اخبار صفحه خانه/.test(shown), `the in-use message does not list the referencing resource: ${shown}`);
      await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
      expect((await adminGet('news', n.id)).item.mediaAssetId === a.id && !!(await adminGet('news', n.id)).item.image, 'the reference or asset was changed by the failed delete');
      return watch.methods.map((m, i) => `${m} ${watch.paths[i].replace(/[0-9a-f-]{36}/, ':id')}`);
    };

    await runTest(spec('MED-06'), asSuper, async (page) => {
      const requests = await deleteReferencedA(page);
      expect(requests.length === 1 && requests[0].startsWith('DELETE'), `unexpected requests: ${requests.join(', ')}`);
      return { requests };
    });

    await runTest(spec('MED-07'), asSuper, async (page) => {
      const e = fx('mediaE');
      await mediaPageLoad(page);
      const card = await findMediaCard(page, e.marker); // the page is loaded WITH the asset visible ...
      const gone = await apiJson('DELETE', `/api/v1/admin/media/${e.id}`); // ... then it disappears elsewhere
      expect(gone.status === 200 || gone.status === 204, `could not remove media E elsewhere: HTTP ${gone.status}`);
      await card.getByRole('button', { name: 'حذف', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click();
      const shown = await page.getByRole('status').filter({ hasText: 'دیگر وجود ندارد' }).first().innerText();
      await page.waitForTimeout(500);
      expect((await page.locator('li.biawin-media-card', { hasText: e.marker }).count()) === 0, 'the list did not reconcile');
      return { shown: clean(shown) };
    });

    await runTest(spec('MED-08'), asSuper, async (page) => {
      const requests = await deleteReferencedA(page);
      expect(requests.length === 1 && requests[0].startsWith('DELETE'), `expected exactly one DELETE, saw: ${requests.join(', ') || 'none'}`);
      expect(!requests.some((r) => /^(PUT|PATCH)/.test(r)), 'the UI tried to detach a reference');
      return { requests };
    });

    // --------------------------------------------------------------- ERRORS / STALE
    await runTest(spec('ERR-01'), asSuper, async (page) => {
      const n = fx('newsStale');
      await openList(page, 'news');
      await rowOf(page, n.marker).first().waitFor();
      const gone = await apiJson('DELETE', `/api/v1/admin/home/news-articles/${n.id}`);
      expect(gone.status === 200 || gone.status === 204, `could not delete elsewhere: HTTP ${gone.status}`);
      await rowOf(page, n.marker).locator('button.biawin-active-toggle').click();
      const shown = await expectAlert(page, 'ممکن است در جای دیگری حذف شده باشد');
      await rowOf(page, n.marker).waitFor({ state: 'detached' });
      return { shown };
    });

    await runTest(spec('ERR-02'), asSuper, async (page) => {
      const n = fx('newsStale2');
      await openList(page, 'news');
      await rowOf(page, n.marker).first().waitFor();
      const gone = await apiJson('DELETE', `/api/v1/admin/home/news-articles/${n.id}`);
      expect(gone.status === 200 || gone.status === 204, `could not delete elsewhere: HTTP ${gone.status}`);
      await rowOf(page, n.marker).locator('button.biawin-home-list-delete').click();
      await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const shown = await expectAlert(page, 'ممکن است در جای دیگری حذف شده باشد');
      await rowOf(page, n.marker).waitFor({ state: 'detached' });
      return { shown };
    });

    await runTest(spec('ERR-03'), asSuper, async (page) => {
      const secret = 'PrismaClientKnownRequestError internal-stack-secret';
      const cap = await stubError(page, 'PUT', /\/admin\/home\/news-articles\//, 500, secret);
      await openList(page, 'news');
      const first = page.locator('table.biawin-home-list-table tbody tr button.biawin-active-toggle').first();
      expect((await first.count()) > 0, 'no news row to toggle');
      await first.click(); // stubbed: the real row never receives this request
      const alert = page.getByRole('alert').first();
      await alert.waitFor();
      const text = await alert.innerText();
      expect(cap.count === 1, `expected 1 stubbed request, saw ${cap.count}`);
      expect(PERSIAN.test(text) && !/Prisma|secret|stack/i.test(text), `the 500 message leaks internals or is not the generic Persian text: ${clean(text)}`);
      return { shown: clean(text) };
    });

    await runTest(spec('ERR-04'), asSuper, async (page) => {
      await page.goto(`${ADMIN}/home/news/not-a-uuid`);
      await waitLoaded(page);
      const alert = page.getByRole('alert').first();
      await alert.waitFor({ timeout: 20_000 });
      const shown = clean(await alert.innerText());
      expect(shown.length > 0, 'no message shown');
      expect(!/(Prisma|Unique constraint|at .*\.js|stack)/i.test(shown), `the page leaks internals: ${shown}`);
      await noConsoleErrors();
      return { shown };
    });

    // --------------------------------------------------------------- REORDER
    const moveUp = (page: Page, marker: string): Promise<void> => rowOf(page, marker).getByRole('button', { name: 'انتقال به بالا' }).click();

    await runTest(spec('REO-01'), asSuper, async (page) => {
      const b = fx('newsReorderB');
      const cap = await captureAndAbort(page, 'PATCH', /\/admin\/home\/news-articles\/reorder$/);
      await openList(page, 'news');
      const listed = (await adminList('news')).map((x) => x.id as string);
      await moveUp(page, b.marker);
      await expectAlert(page, /./);
      expect(cap.count === 1, `expected 1 captured reorder request, saw ${cap.count}`);
      const problems = analyzeReorderPayload(cap.bodies[0], listed);
      expect(problems.length === 0, `reorder payload problems: ${problems.join('; ')}`);
      expect(cap.bodies[0].items.length === listed.length, 'the payload is not the whole displayed list');
      return { items: cap.bodies[0].items.length };
    });

    await runTest(spec('REO-02'), asSuper, async (page) => {
      const a = fx('newsReorderA');
      const b = fx('newsReorderB');
      await openList(page, 'news');
      const order = async (): Promise<string[]> => (await adminList('news')).map((x) => x.id as string);
      const before = await order();
      await moveUp(page, b.marker);
      await page.waitForTimeout(800);
      const swapped = await order();
      expect(swapped.indexOf(b.id) < swapped.indexOf(a.id), 'B did not move above A');
      await openList(page, 'news');
      await moveUp(page, a.marker);
      await page.waitForTimeout(800);
      const restored = await order();
      expect(JSON.stringify(restored) === JSON.stringify(before), 'the original order was not restored');
      return { restored: true };
    });

    await runTest(spec('REO-03'), asSuper, async (page) => {
      const a = fx('newsReorderA');
      let gets = 0;
      page.on('request', (r) => {
        if (r.method() === 'GET' && /\/admin\/home\/news-articles(\?|$)/.test(r.url())) gets += 1;
      });
      const cap = await stubError(page, 'PATCH', /\/admin\/home\/news-articles\/reorder$/, 422, 'برخی از موارد ارسال‌شده وجود ندارند.', { unknownIds: [a.id] });
      await openList(page, 'news');
      const base = gets;
      await rowOf(page, a.marker).getByRole('button', { name: 'انتقال به پایین' }).or(rowOf(page, a.marker).getByRole('button', { name: 'انتقال به بالا' })).first().click();
      const shown = await expectAlert(page, /نامعتبر/);
      await page.waitForTimeout(800);
      expect(cap.count === 1, `expected 1 stubbed request, saw ${cap.count}`);
      expect(gets > base, 'the list was not refetched after the 422');
      return { shown };
    });

    await runTest(spec('REO-04'), asSuper, async (page) => {
      const a = fx('newsReorderA');
      const cap = await stubError(page, 'PATCH', /\/admin\/home\/news-articles\/reorder$/, 500, 'internal failure text');
      await openList(page, 'news');
      const titles = (): Promise<string[]> => page.locator('table.biawin-home-list-table tbody tr .biawin-home-list-title').allInnerTexts();
      const before = await titles();
      await rowOf(page, a.marker).getByRole('button', { name: 'انتقال به پایین' }).or(rowOf(page, a.marker).getByRole('button', { name: 'انتقال به بالا' })).first().click();
      const shown = await expectAlert(page, /./);
      expect(!/internal failure text/.test(shown), 'the raw 500 text is displayed');
      await page.waitForTimeout(500);
      expect(JSON.stringify(await titles()) === JSON.stringify(before), 'the list order changed although the reorder failed');
      expect(cap.count === 1, `expected 1 stubbed request, saw ${cap.count}`);
      return { shown };
    });

    // --------------------------------------------------------------- RBAC
    await runTest(spec('RBAC-01'), asRole('SUPPORT_VIEWER'), async (page) => {
      const watch = watchMutations(page);
      for (const r of ['hero', 'banner', 'mosaic', 'news'] as Resource[]) {
        await openList(page, r);
        await page.locator('h1').first().waitFor();
        expect((await page.locator('a[href$="/new"]').count()) === 0, `${r}: a create control is visible`);
        expect((await page.locator('button.biawin-home-list-delete').count()) === 0, `${r}: a delete control is visible`);
        expect((await page.locator('.biawin-reorder-controls').count()) === 0, `${r}: reorder controls are visible`);
        const toggles = page.locator('button.biawin-active-toggle');
        const n = await toggles.count();
        for (let i = 0; i < n; i++) expect(await toggles.nth(i).isDisabled(), `${r}: an active toggle is enabled`);
      }
      expect(watch.count === 0, 'the read-only role sent a mutating request');
      return { requests: 0 };
    });

    await runTest(spec('RBAC-02'), asRole('SUPPORT_VIEWER'), async (page) => {
      const watch = watchMutations(page);
      for (const r of ['hero', 'banner', 'mosaic', 'news'] as Resource[]) {
        const first = (await adminList(r))[0];
        if (first) {
          await openEdit(page, r, first.id);
          expect((await page.locator('form.biawin-home-form button[type="submit"]').count()) === 0, `${r}: an edit page has a submit button`);
          expect(await page.locator('fieldset.biawin-home-form-fieldset').evaluate((el) => (el as HTMLFieldSetElement).disabled), `${r}: the form fields are enabled`);
        }
        await page.goto(`${ADMIN}${RESOURCE_PATH[r].list}/new`);
        await page.waitForURL(new RegExp(`${esc(RESOURCE_PATH[r].list)}/?$`), { timeout: 20_000 });
      }
      expect(watch.count === 0, 'the read-only role sent a mutating request');
      return { requests: 0 };
    });

    await runTest(spec('RBAC-03'), asRole('SUPPORT_VIEWER'), async (page) => {
      await mediaPageLoad(page);
      await page.locator('li.biawin-media-card').first().waitFor();
      expect((await page.locator('button.biawin-media-card-delete').count()) === 0, 'a delete control is visible to the read-only role');
      return { deleteControls: 0 };
    });

    await runTest(spec('RBAC-04'), asRole('CONTENT_EDITOR'), async (page) => {
      await newsCreateForm(page, 'editorNews');
      const id = await createdId(page, 'news', () => submitForm(page));
      const d = fx('mediaD2');
      await mediaPageLoad(page);
      const card = await findMediaCard(page, d.marker);
      await card.getByRole('button', { name: 'حذف', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'فایل حذف شد.' }).waitFor();
      return { created: id, deletedMedia: true };
    });
  } catch (err) {
    crashed = clean(err instanceof Error ? err.message : String(err));
    log(`browser verifier crashed: ${crashed}`);
  } finally {
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
    await browser.close().catch(() => undefined);
    writeResults();
  }
  return crashed ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    crashed = clean(err instanceof Error ? err.message : String(err));
    writeResults();
    process.exitCode = 1;
  });
