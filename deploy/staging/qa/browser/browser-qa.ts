/**
 * Stage 5.22 — authenticated staging QA runner (browser/visual layer).
 *
 * Run ONLY via deploy/staging/run-authenticated-qa.sh, which builds and
 * runs the Dockerfile in this directory (the official Playwright image —
 * `backend`'s own node:20-alpine image cannot run Playwright's Chromium,
 * which needs glibc, not Alpine's musl libc).
 *
 * Selectors here are grounded in the real component source (no
 * `data-testid`/ARIA-role convention exists anywhere in apps/admin or
 * apps/web as of Stage 5.22 — confirmed by a full-tree search — so this
 * matches on the real visible Persian text/labels/input types instead,
 * each with a file:line citation in a comment above it). If the UI copy
 * changes, the comment tells you exactly what to update here.
 *
 * This complements, not replaces, authenticated-qa-runner.ts (the API
 * layer, which covers RBAC/CRUD/propagation/audit-log with much higher
 * confidence — it asserts on JSON fields read directly from source, not
 * on rendered text). This script's job is specifically what the API layer
 * structurally cannot prove: does the real page actually render, are
 * there broken images or console/network errors, and does the Stage 5.20
 * Media Picker regression (accidental outer-form submit) still not
 * happen in the real browser.
 *
 * No pixel-diff against the Stage 5.14.1 baseline is attempted — no
 * baseline image is available as a repository artifact to compare
 * against. This produces reproducible screenshots plus structural
 * checks (no broken images, no layout overflow, critical DOM sections
 * present) and says so explicitly in the report; exact visual comparison
 * against the approved baseline remains a human sign-off, called out
 * plainly at the end of the report.
 */
import { chromium, type Browser, type ConsoleMessage, type Page, type Request, type Frame } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const CUSTOMER_ORIGIN = process.env.QA_CUSTOMER_ORIGIN || 'https://staging.biawin.ir';
const ADMIN_ORIGIN = process.env.QA_ADMIN_ORIGIN || 'https://admin-staging.biawin.ir';
const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL;
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const REPORT_DIR = process.env.QA_REPORT_DIR ?? '/tmp/biawin-staging-qa';
const SCREENSHOT_DIR = `${REPORT_DIR}/screenshots`;
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');

const MOBILE = { width: 390, height: 844 };
const MOBILE_375 = { width: 375, height: 812 };
const MOBILE_430 = { width: 430, height: 932 };
const RESPONSIVE_WIDTHS = [MOBILE_375, MOBILE, MOBILE_430];
const DESKTOP = { width: 1440, height: 900 };
const API_ORIGIN = process.env.QA_API_ORIGIN || 'https://api-staging.biawin.ir';

type Status = 'PASS' | 'FAIL' | 'NOT_TESTED';
interface Result {
  name: string;
  status: Status;
  detail: string;
}
const results: Result[] = [];

function record(name: string, status: Status, detail = ''): void {
  results.push({ name, status, detail });
  const marker = status === 'PASS' ? 'PASS ' : status === 'FAIL' ? 'FAIL ' : 'SKIP ';
  console.log(`[browser-qa] ${marker} ${name}${detail ? ' — ' + detail : ''}`);
}

/**
 * SERVICES-R1.6 (Task 8): the currently-running step's name, readable by
 * `trackPageIssues` so a failed request's diagnostics record exactly which
 * QA action was in flight when it started/failed — direct evidence for
 * correlating an abort with a specific script action, not a guess. A
 * single module-level variable is safe here because `main()` runs every
 * check sequentially (admin, then customer, then the isolation context),
 * never in parallel.
 */
let currentStepLabel = '(before any step)';

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const previousLabel = currentStepLabel;
  currentStepLabel = name;
  try {
    const value = await fn();
    record(name, 'PASS');
    return value;
  } catch (err) {
    record(name, 'FAIL', err instanceof Error ? err.message : String(err));
    return undefined;
  } finally {
    currentStepLabel = previousLabel;
  }
}

function skip(name: string, reason: string): void {
  record(name, 'NOT_TESTED', reason);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

interface FailedRequestEvent {
  url: string;
  method: string;
  resourceType: string;
  errorText: string;
  pageUrlAtStart: string;
  pageUrlAtFailure: string;
  qaStepAtStart: string;
  qaStepAtFailure: string;
  elapsedMs: number;
  navigationCorrelated: boolean;
  classifiedBenign: boolean;
  benignReason?: string;
}

interface PageIssues {
  consoleErrors: string[];
  failedRequests: string[];
  /** Every requestfailed event this page saw, benign-classified or not — kept for the report's diagnostics section so a benign classification is always auditable, never just asserted. */
  allFailedRequestEvents: FailedRequestEvent[];
  /**
   * SERVICES-R1.7 finding: Chromium cancels a document's outstanding
   * subresource requests at the INSTANT a new top-level navigation is
   * initiated (`page.goto()` called) — measurably before `framenavigated`
   * fires (which only reports once the new document has committed). A
   * request that had been sitting queued/deprioritized by the browser's own
   * connection-priority scheduling (exactly what a burst of ~19 category
   * icon requests competing with fetch/XHR traffic causes) can be aborted
   * at that earlier instant, yet still land outside the `framenavigated`-
   * based correlation window recorded before this fix — a real run showed
   * `navigationCorrelated=false` for an abort whose only plausible
   * cause was a `page.goto()` a few lines away. Call this immediately
   * before every `page.goto()` so the TRUE cancellation instant is always
   * captured, not just the later commit event.
   */
  markNavigationAttempt: () => void;
}

/**
 * Next.js App Router prefetches RSC (React Server Component) payloads for
 * `<Link>`s it can see, tagged with a `?_rsc=<buildId>` query param — e.g.
 * AdminSidebar's sibling Home nav links prefetching while this script is
 * still on one of them. When this script's own `page.goto()` navigates
 * away before an in-flight prefetch finishes, Chromium cancels it
 * client-side and reports `net::ERR_ABORTED` — no request was ever
 * attempted against a broken endpoint; the browser voluntarily gave up on
 * a background fetch that navigation made moot. This is standard,
 * well-documented Next.js App Router behavior in ANY automated test that
 * navigates through the app, not a sign of anything broken.
 *
 * The filter below is deliberately narrow — ALL THREE of:
 *   1. the specific error text `net::ERR_ABORTED` (not a real network
 *      failure like ERR_CONNECTION_REFUSED or a timeout),
 *   2. resourceType `fetch` (RSC payload requests are always background
 *      `fetch()` calls, never the primary `document` navigation, never an
 *      `image`/`script`/etc.),
 *   3. a `_rsc=` query parameter present (Next.js's own literal marker for
 *      this exact request class)
 * must hold before a failed request is excluded. A real failure of the
 * primary document, an API call, a media request, or any non-ERR_ABORTED
 * error — even on a URL that happens to contain `_rsc=` — still fails the
 * run, same as before.
 */
function isBenignNextRscCancellation(req: Request, errorText: string): boolean {
  return errorText === 'net::ERR_ABORTED' && req.resourceType() === 'fetch' && req.url().includes('_rsc=');
}

/**
 * BENIGN RENDER-LIFECYCLE IMAGE CANCELLATION (SERVICES-R1.4, tightened
 * SERVICES-R1.6/R1.7). A real run reported `net::ERR_ABORTED` on 5 of the
 * migrated Services category icons — all five independently verified
 * (HTTP curl, outside the browser) to return 200 + `image/webp` + the
 * correct real byte size, with the same run's "no broken images" and all
 * responsive-screenshot assertions PASSing. The 5 named icons are exactly
 * the ones that only become visible once "بیشتر" expands the grid to all
 * 19 categories — a burst of ~19 image requests competing with fetch/XHR
 * traffic for Chromium's per-origin connection budget, which can leave
 * some genuinely QUEUED (not yet dispatched) for a while.
 *
 * SERVICES-R1.7 finding: a later run showed `navigationCorrelated=
 * false` for an abort whose only plausible trigger was a `page.goto()` a
 * few lines later in the same script — because Chromium cancels a
 * document's outstanding subresources the INSTANT a new navigation is
 * initiated, measurably before `framenavigated` fires (which only reports
 * once the new document commits). A request that had been queued since
 * "بیشتر" can be aborted at that earlier instant yet still land outside a
 * correlation window built only from `framenavigated` timestamps. Fixed
 * by having every `page.goto()` call `issues.markNavigationAttempt()`
 * immediately beforehand (see `PageIssues.markNavigationAttempt`'s own
 * comment) — this captures the TRUE cancellation instant, not just the
 * later commit event, closing that gap without widening what counts as
 * "a navigation."
 *
 * This rule is deliberately as narrow as the RSC-fetch rule above — ALL
 * FOUR of: exact `net::ERR_ABORTED`, `resourceType() === 'image'`, a
 * first-party `/services/*.webp` static asset path (our own migrated
 * icons — never a third-party or backend-served image), AND a real
 * top-level page navigation recorded while THIS SPECIFIC request was
 * still in flight (its own start-to-failure window, not just "near" the
 * failure — see `navigationCorrelated` below). A broken image outside
 * that window, a non-webp/non-Services path, or any other error text
 * still fails the run, unchanged.
 */
function isBenignImageCancelledByNavigation(req: Request, errorText: string, navigationCorrelated: boolean): boolean {
  return (
    errorText === 'net::ERR_ABORTED' &&
    req.resourceType() === 'image' &&
    /^https?:\/\/[^/]+\/services\/[^/]+\.webp(\?.*)?$/.test(req.url()) &&
    navigationCorrelated
  );
}

/**
 * BENIGN TEST-NAVIGATION CATALOG FETCH CANCELLATION (SERVICES-R1.5,
 * root-caused SERVICES-R1.8). A real run reported `net::ERR_ABORTED` on
 * `/api/v1/categories` and `/api/v1/services` — the exact endpoints
 * `useServiceCatalog()` (apps/web/src/components/services/useServiceCatalog.ts)
 * calls on every mount of `/services` AND independently again on every
 * mount of `/services/[categoryId]` (including a REMOUNT — e.g. a
 * `goBack()` back onto a Category View page mounts a fresh
 * `useServiceCatalog()` instance, with its own fresh fetch). That hook has
 * no `AbortController` — the application never voluntarily cancels these
 * — but Chromium cancels a document's outstanding subresources itself,
 * including ones still queued behind other traffic (never actually
 * dispatched), the instant that document is torn down by a NEW
 * navigation. Both endpoints were independently verified (curl, outside
 * the browser) to return HTTP 200 + valid JSON with the real catalog
 * payload — not a real backend failure.
 *
 * SERVICES-R1.8 root cause: a stale `useServiceCatalog()` fetch from an
 * EARLIER page instance (e.g. one a `goBack()`-triggered remount created)
 * can sit queued long enough that its own `request`/`requestfailed`
 * lifecycle only surfaces at/after a LATER, unrelated navigation tears
 * the whole page down — explaining why the failure's `pageUrlAtStart`/
 * `pageUrlAtFailure`/`qaStepAtStart` can all still show an OLDER category,
 * not whichever navigation actually triggered the cancellation. Confirmed
 * by direct code reading, not inferred from the page URL alone — see
 * `ServiceCategoryPage`'s `useServiceCatalog()` call and its lack of any
 * abort/dedup mechanism.
 *
 * Narrow rule — ALL FOUR of: exact `net::ERR_ABORTED`, `resourceType()
 * === 'fetch'`, the URL is exactly our own first-party
 * `/api/v1/categories` or `/api/v1/services` catalog endpoint (never any
 * other API route — an aborted mutation or auth call is NEVER covered by
 * this), AND a real, test-driven navigation mark (`markNavigationAttempt()`,
 * called immediately before every `page.goto()`/navigating click/
 * `goBack()` in this file) recorded near the failure — see
 * `navigationCorrelated`'s own comment for why this is now anchored to
 * the failure instant, not the request's own observed start. A catalog
 * fetch that fails outside that window, or any other API endpoint, still
 * fails the run.
 */
function isBenignCatalogFetchCancelledByNavigation(req: Request, errorText: string, navigationCorrelated: boolean): boolean {
  return (
    errorText === 'net::ERR_ABORTED' &&
    req.resourceType() === 'fetch' &&
    /^https?:\/\/[^/]+\/api\/v1\/(categories|services)(\?.*)?$/.test(req.url()) &&
    navigationCorrelated
  );
}

/**
 * BENIGN HOME-PAGE IMAGE CANCELLATION (SERVICES-R5.26.2) — the exact same
 * render-lifecycle class `isBenignImageCancelledByNavigation` above already
 * covers for `/services/*.webp`, just for the two image sources the real
 * Customer Home page itself requests in bulk on every mount: the 12-item
 * orbit ring (`OrbitItem.imageKey`, resolved through the real Media Library
 * as `/api/v1/media/*.webp` since SERVICES-R5.22) and the 8-image
 * membership story strip (static `/home/membership/item-NN.webp`). A real
 * run navigating Home -> Category Landing (this file's own
 * `runCategoryLandingAndCardProductChecks`, which smoke-tests Home first)
 * reported `net::ERR_ABORTED` on several of both, all `navigationCorrelated
 * = true` — and every one independently verified (curl, outside the
 * browser) to return a real HTTP 200 + `image/webp`, not a backend failure.
 * Narrow on purpose, same four conditions as the sibling rule above: exact
 * `net::ERR_ABORTED`, `resourceType() === 'image'`, one of these two exact
 * first-party path shapes, AND a real navigation recorded while this
 * specific request was in flight. Anything else — a different path, a
 * different error, or no correlated navigation — still fails the run.
 */
function isBenignHomeImageCancelledByNavigation(req: Request, errorText: string, navigationCorrelated: boolean): boolean {
  return (
    errorText === 'net::ERR_ABORTED' &&
    req.resourceType() === 'image' &&
    (/^https?:\/\/[^/]+\/api\/v1\/media\/[^/]+\.webp(\?.*)?$/.test(req.url()) ||
      /^https?:\/\/[^/]+\/home\/membership\/item-\d+\.webp(\?.*)?$/.test(req.url())) &&
    navigationCorrelated
  );
}

/**
 * BENIGN HOME-CMS FETCH CANCELLATION (R5.26.2 Targeted QA Fix) — the exact
 * same class `isBenignCatalogFetchCancelledByNavigation` above already
 * covers for `/api/v1/categories|services`, for the four public Home CMS
 * endpoints `useHomeHeroCards`/`useHomeServiceBanners`/
 * `useHomeServiceMosaic`/`useHomeNewsArticles` each call on every mount of
 * Customer Home (`apps/web/src/components/home/useHomeCms.ts`, via
 * `homeApi.listHomeHeroCards()` etc. in `apps/web/src/lib/home-api.ts`).
 * None of those hooks use an `AbortController` — each just sets a local
 * `cancelled` flag to skip the `setState` after unmount, same
 * fire-and-forget shape `useServiceCatalog()` already had — so Chromium
 * itself cancels any of the four still in flight the instant this script's
 * own navigation away from Home (e.g. `runCategoryLandingAndCardProductChecks`,
 * which smoke-tests Home before navigating into a Category) tears the page
 * down. All four endpoints independently verified (curl, outside the
 * browser) to return real HTTP 200 JSON — not a backend failure. Narrow on
 * purpose, same shape as the sibling catalog rule: exact `net::ERR_ABORTED`,
 * `resourceType() === 'fetch'`, the URL is exactly one of our own
 * first-party `/api/v1/home/{hero-cards,service-banners,
 * service-mosaic-tiles,news-articles}` endpoints (never any other route —
 * an aborted mutation or auth call is NEVER covered by this), AND a real
 * navigation recorded near the failure. A home-CMS fetch that fails outside
 * a correlated navigation, or any other endpoint, still fails the run.
 */
function isBenignHomeCmsFetchCancelledByNavigation(req: Request, errorText: string, navigationCorrelated: boolean): boolean {
  return (
    errorText === 'net::ERR_ABORTED' &&
    req.resourceType() === 'fetch' &&
    /^https?:\/\/[^/]+\/api\/v1\/home\/(hero-cards|service-banners|service-mosaic-tiles|news-articles)(\?.*)?$/.test(req.url()) &&
    navigationCorrelated
  );
}

function trackPageIssues(page: Page): PageIssues {
  const navigationTimestamps: number[] = [];
  const issues: PageIssues = {
    consoleErrors: [],
    failedRequests: [],
    allFailedRequestEvents: [],
    markNavigationAttempt: () => navigationTimestamps.push(Date.now()),
  };
  // SERVICES-R1.5: precise per-request correlation, not a flat time
  // window — records exactly when EACH request started (and the page URL
  // at that moment), so a failure can be checked against whether a real
  // navigation happened strictly between that request's own start and its
  // failure, not merely "close in time" to the failure by coincidence.
  const requestStarts = new Map<Request, { startTime: number; pageUrlAtStart: string; qaStepAtStart: string }>();

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigationTimestamps.push(Date.now());
  });
  page.on('request', (req: Request) => {
    requestStarts.set(req, { startTime: Date.now(), pageUrlAtStart: page.url(), qaStepAtStart: currentStepLabel });
  });
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') issues.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req: Request) => {
    const errorText = req.failure()?.errorText ?? 'unknown';
    const failureTime = Date.now();
    const started = requestStarts.get(req);
    const startTime = started?.startTime ?? failureTime;
    const pageUrlAtStart = started?.pageUrlAtStart ?? 'unknown (request event not captured)';
    const qaStepAtStart = started?.qaStepAtStart ?? 'unknown (request event not captured)';
    // SERVICES-R1.8 finding: a real run proved the `t >= startTime`
    // requirement below was backwards for a real, provable case. Evidence:
    // a `/api/v1/services` abort with `pageUrlAtStart === pageUrlAtFailure`
    // (both the OLD category's URL — a `page.goto()` to a NEW category had
    // NOT yet committed) and `elapsedMs=33` — i.e. the request's own
    // `request` event was only reported by Chromium/CDP essentially AT THE
    // MOMENT of teardown, not when the request was logically issued by the
    // app (it had likely been sitting queued behind other traffic, exactly
    // like the icon-image case). A `page.goto()`/click/`goBack()` "mark"
    // (`markNavigationAttempt()`, called immediately before every one of
    // those in this file) can therefore legitimately land BEFORE this
    // request's own observed start, not just between its start and
    // failure — the old `t >= startTime` check would incorrectly reject
    // exactly that case. The reliable causal signal is proximity to the
    // FAILURE instant (when the browser actually acts on the cancellation),
    // not the request's own start-to-failure window — so this checks
    // whether ANY navigation mark landed within a fixed, still-narrow
    // window of the failure, in either direction.
    const NAV_CORRELATION_WINDOW_MS = 2000;
    const navigationCorrelated = navigationTimestamps.some((t) => Math.abs(t - failureTime) <= NAV_CORRELATION_WINDOW_MS);

    let classifiedBenign = false;
    let benignReason: string | undefined;
    if (isBenignNextRscCancellation(req, errorText)) {
      classifiedBenign = true;
      benignReason = 'Next.js RSC prefetch cancelled by navigation (Stage 5.22 rule)';
    } else if (isBenignImageCancelledByNavigation(req, errorText, navigationCorrelated)) {
      classifiedBenign = true;
      benignReason = 'BENIGN RENDER-LIFECYCLE IMAGE CANCELLATION: first-party /services/*.webp request cancelled during an in-flight navigation, asset independently verified healthy (SERVICES-R1.4/R1.7 rule)';
    } else if (isBenignCatalogFetchCancelledByNavigation(req, errorText, navigationCorrelated)) {
      classifiedBenign = true;
      benignReason = 'BENIGN TEST-NAVIGATION CATALOG FETCH CANCELLATION: first-party /api/v1/categories|services catalog fetch cancelled by a test-driven navigation (page.goto/click/goBack) tearing down the page that issued it, endpoint independently verified healthy (SERVICES-R1.5/R1.8 rule)';
    } else if (isBenignHomeImageCancelledByNavigation(req, errorText, navigationCorrelated)) {
      classifiedBenign = true;
      benignReason = 'BENIGN HOME-PAGE IMAGE CANCELLATION: Home page orbit-ring (/api/v1/media/*.webp) or membership-strip (/home/membership/item-NN.webp) image request cancelled during an in-flight navigation, asset independently verified healthy (SERVICES-R5.26.2 rule)';
    } else if (isBenignHomeCmsFetchCancelledByNavigation(req, errorText, navigationCorrelated)) {
      classifiedBenign = true;
      benignReason = 'BENIGN HOME-CMS FETCH CANCELLATION: first-party /api/v1/home/{hero-cards,service-banners,service-mosaic-tiles,news-articles} fetch cancelled by a test-driven navigation tearing down Home before the hook\'s fire-and-forget fetch resolved, endpoint independently verified healthy (R5.26.2 Targeted QA Fix rule)';
    }

    const qaStepAtFailure = currentStepLabel;
    issues.allFailedRequestEvents.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      errorText,
      pageUrlAtStart,
      pageUrlAtFailure: page.url(),
      qaStepAtStart,
      qaStepAtFailure,
      elapsedMs: failureTime - startTime,
      navigationCorrelated,
      classifiedBenign,
      benignReason,
    });

    if (classifiedBenign) return;
    issues.failedRequests.push(
      `${req.method()} ${req.url()} — ${errorText} (resourceType=${req.resourceType()}, pageUrlAtStart=${pageUrlAtStart}, pageUrlAtFailure=${page.url()}, qaStepAtStart="${qaStepAtStart}", qaStepAtFailure="${qaStepAtFailure}", elapsedMs=${failureTime - startTime}, navigationCorrelated=${navigationCorrelated})`,
    );
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      issues.failedRequests.push(`${res.request().method()} ${res.url()} — HTTP ${res.status()}`);
    }
  });
  return issues;
}

async function assertNoBrokenImages(page: Page): Promise<{ total: number; broken: string[] }> {
  return page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const broken = imgs.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src);
    return { total: imgs.length, broken };
  });
}

async function assertNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

interface CategorySnapshot {
  id: string;
  name: string;
  description: string;
  slug: string | null;
  active: boolean;
}
interface ServiceSnapshot {
  id: string;
  categoryId: string;
  title: string;
  availableMethods: string[];
  merchantId: string | null;
}
interface CardProductSnapshot {
  id: string;
  serviceId: string;
  title: string;
  status: string;
  cardType: string;
  journeyType: string;
  priceAmount: number | null;
  valueAmount: number | null;
}

/**
 * SERVICES-R1.1 — cross-checks the LIVE rendered Services UI against the
 * real backend catalog via the same public, unauthenticated endpoints
 * `useServiceCatalog` itself calls (GET /api/v1/categories, GET
 * /api/v1/services) — proves the browser is showing real domain data, not
 * a cached/stale/synthetic substitute, independent of anything this
 * script clicks through in the UI.
 */
async function fetchServiceCatalogSnapshot(): Promise<{ categories: CategorySnapshot[]; services: ServiceSnapshot[] }> {
  const catRes = await fetch(`${API_ORIGIN}/api/v1/categories?limit=100`);
  const catJson = (await catRes.json()) as { data: { items: CategorySnapshot[] } };

  const services: ServiceSnapshot[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${API_ORIGIN}/api/v1/services?limit=100&page=${page}`);
    const json = (await res.json()) as { data: { items: ServiceSnapshot[]; total: number } };
    services.push(...json.data.items);
    if (services.length >= json.data.total) break;
  }
  return { categories: catJson.data.items, services };
}

async function main(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  console.log(`[browser-qa] targets: customer=${CUSTOMER_ORIGIN} admin=${ADMIN_ORIGIN}`);

  const browser: Browser = await chromium.launch({ headless: true });

  try {
    await runAdminChecks(browser);
    await runCustomerChecks(browser);
    await runBackNavigationIsolationCheck(browser);
  } finally {
    await browser.close();
    writeReport();
  }
}

// ---------------------------------------------------------------------------
// Admin checks
// ---------------------------------------------------------------------------

async function runAdminChecks(browser: Browser): Promise<void> {
  if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD) {
    skip('Admin browser login', 'ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not present in this container\'s environment');
    return;
  }

  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const issues = trackPageIssues(page);

  const loggedIn = await step('Admin browser login (real login form, real click)', async () => {
    // AdminLoginForm.tsx: <label><span>ایمیل</span><Input type="email" .../></label>
    // and <span>رمز عبور</span><Input type="password" .../>, submit button text "ورود".
    await page.goto(`${ADMIN_ORIGIN}/login`, { waitUntil: 'networkidle' });
    const email = page.getByLabel('ایمیل').or(page.locator('input[type="email"]'));
    const password = page.getByLabel('رمز عبور').or(page.locator('input[type="password"]'));
    await email.first().fill(ADMIN_SEED_EMAIL!);
    await password.first().fill(ADMIN_SEED_PASSWORD!);
    await page.getByRole('button', { name: 'ورود' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    const hasToken = await page.evaluate(() => !!localStorage.getItem('biawin.admin.accessToken'));
    assert(hasToken, 'expected biawin.admin.accessToken in localStorage after login');
    return true;
  });

  if (!loggedIn) {
    skip('Admin Home screenshots', 'admin browser login did not succeed');
    skip('Media Picker regression (browser)', 'admin browser login did not succeed');
    await reportPageIssues('Admin login page', issues);
    await context.close();
    return;
  }

  await step('Admin dashboard renders with no broken images / no horizontal overflow', async () => {
    const { total, broken } = await assertNoBrokenImages(page);
    assert(broken.length === 0, `${broken.length}/${total} broken <img> elements: ${broken.slice(0, 3).join(', ')}`);
    assert(await assertNoHorizontalOverflow(page), 'unexpected horizontal overflow on the dashboard');
  });

  await step('Admin Home hero-cards list renders', async () => {
    // AdminSidebar.tsx NAV_ITEMS: "کارت‌های ابتدایی" -> /home/hero-cards
    await page.goto(`${ADMIN_ORIGIN}/home/hero-cards`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 10000 });
  });

  await captureScreenshot(page, 'admin-home-hero-cards-desktop', DESKTOP);
  await page.setViewportSize(MOBILE);
  await captureScreenshot(page, 'admin-home-hero-cards-mobile', MOBILE);
  await page.setViewportSize(DESKTOP);

  await adminCatalogChecks(page);

  await mediaPickerRegressionCheck(page);

  await reportPageIssues('Admin (login + dashboard + home + media picker)', issues);
  await context.close();
}

/**
 * SERVICES-R5.26.1 — before this stage, no Admin catalog page
 * (Category/CategoryCard/Service/CardProduct — all four `/catalog/*`
 * routes, confirmed present in `apps/admin`'s own build output) had ANY
 * browser-level screenshot or render coverage; only the API-layer QA
 * exercised them. Deliberately just render/list/no-broken-image/no-console-
 * error proof, same shallow depth as the Home hero-cards check above — the
 * deep CRUD/ownership assertions already live in `authenticated-qa-runner.ts`
 * (`categoryCardOwnershipAndCrudCheck`), which asserts on real JSON, not
 * rendered text.
 *
 * SERVICES-R5.26.2 root-cause fix — the original version of this function
 * called `page.waitForSelector('table', ...)` unconditionally. Both
 * `CatalogListTable.tsx` and `ResourceListPage.tsx` (confirmed by reading
 * their source) render NO `<table>` at all when the list is genuinely
 * empty — just a `<p>{emptyLabel}</p>` — which is a real, valid state, not
 * a defect. Before this stage's default-catalog seed was wired into the
 * official deploy pipeline (`deploy.sh`'s new `DEFAULT_CATALOG_CMD` step),
 * a fresh/staging environment's CardProducts list was genuinely empty, and
 * this exact line is why that legitimate empty state was reported as a
 * browser-QA FAIL instead of a PASS. Fixed by racing the real `<table>`
 * against the real, exact `emptyLabel` text for each page (mirrors the
 * "BENIGN vs REAL" pattern already used elsewhere in this file for network
 * failures) — both are valid terminal states now.
 */
const CATALOG_EMPTY_LABELS: Record<string, string> = {
  '/catalog/categories': 'هنوز دسته‌بندی‌ای ثبت نشده است.',
  '/catalog/category-cards': 'هنوز کارت دسته‌بندی‌ای ثبت نشده است.',
  '/catalog/services': 'هنوز خدمتی ثبت نشده است.',
  '/catalog/card-products': 'هنوز کارت محصولی ثبت نشده است.',
};

async function adminCatalogChecks(page: Page): Promise<void> {
  const catalogPages: Array<{ path: string; label: string; screenshot: string }> = [
    { path: '/catalog/categories', label: 'Admin catalog — Categories list', screenshot: 'admin-catalog-categories' },
    { path: '/catalog/category-cards', label: 'Admin catalog — CategoryCards list', screenshot: 'admin-catalog-category-cards' },
    { path: '/catalog/services', label: 'Admin catalog — Services list', screenshot: 'admin-catalog-services' },
  ];

  for (const cp of catalogPages) {
    await step(`${cp.label} renders (populated or a real, valid empty state — no broken images)`, async () => {
      await page.goto(`${ADMIN_ORIGIN}${cp.path}`, { waitUntil: 'networkidle' });
      const table = page.locator('table.biawin-catalog-list-table');
      const emptyState = page.getByText(CATALOG_EMPTY_LABELS[cp.path], { exact: true });
      await table.or(emptyState).first().waitFor({ timeout: 10000 });
      const isPopulated = await table.count() > 0;
      if (isPopulated) {
        const rowCount = await table.locator('tbody tr').count();
        assert(rowCount > 0, `expected the real <table> on ${cp.path} to have at least one row`);
      } else {
        assert(await emptyState.isVisible(), `expected the real empty-state copy on ${cp.path}`);
      }
      const { broken } = await assertNoBrokenImages(page);
      assert(broken.length === 0, `broken images on ${cp.path}`);
    });
    await captureScreenshot(page, cp.screenshot, DESKTOP);
  }

  await adminCardProductsCheck(page);
}

/**
 * SERVICES-R5.26.2 — CardProducts gets its own, stronger check per this
 * stage's explicit acceptance bar: after the default-catalog seed actually
 * ran (this stage wires it into `deploy.sh`), the list must be genuinely
 * POPULATED with >= 5 real rows — not merely "a table exists." Still
 * structurally handles a genuinely empty catalog as a valid, passing state
 * (same empty-state race as the other three pages) rather than assuming
 * population, per this stage's explicit "test both branches" requirement —
 * but only the populated branch additionally opens a real CardProduct's
 * edit page and confirms its image resolves through the real Media
 * Library (a `<img src="...">` under `.biawin-media-picker-field-preview`,
 * never a raw storage key) and its price/value fields are present.
 */
async function adminCardProductsCheck(page: Page): Promise<void> {
  const path = '/catalog/card-products';
  await page.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: 'networkidle' });
  const table = page.locator('table.biawin-catalog-list-table');
  const emptyState = page.getByText(CATALOG_EMPTY_LABELS[path], { exact: true });

  await step('Admin catalog — CardProducts list renders (populated or a real, valid empty state — no broken images)', async () => {
    await table.or(emptyState).first().waitFor({ timeout: 10000 });
    const { broken } = await assertNoBrokenImages(page);
    assert(broken.length === 0, `broken images on ${path}`);
  });
  await captureScreenshot(page, 'admin-catalog-card-products', DESKTOP);

  const isPopulated = await table.count() > 0;
  if (!isPopulated) {
    skip(
      'Admin catalog — CardProducts populated-state checks (>= 5 rows, real image/price/value on detail)',
      'NOT_TESTED — the CardProducts list is genuinely empty on this environment today (a real, valid state the empty-state check above already confirmed renders correctly) — nothing to open.',
    );
    return;
  }

  await step('Admin catalog — CardProducts list has at least 5 real rows (SERVICES-R5.26.2 acceptance bar)', async () => {
    const rowCount = await table.locator('tbody tr').count();
    assert(rowCount >= 5, `expected >= 5 real CardProduct rows, found ${rowCount}`);
  });

  await step('Admin catalog — opening a real CardProduct shows its real image (Media Library, never a raw storage key) and its price/value fields', async () => {
    await table.locator('tbody tr').first().locator('a').first().click();
    await page.waitForURL(/\/catalog\/card-products\/[^/]+$/, { timeout: 15000 });
    // EditCardProductContent fetches the row client-side and renders only
    // "در حال بارگذاری…" until that resolves (confirmed in its own source,
    // apps/admin/src/app/catalog/card-products/[id]/page.tsx) — the same
    // loading-skeleton race already fixed once for the Purchase result page
    // (SERVICES-R5.26). `networkidle` alone can resolve before that re-render
    // lands, so wait for the real form's own price-field label instead.
    await page.getByText('مبلغ (ریال)', { exact: true }).waitFor({ timeout: 10000 });
    const html = await page.content();
    assert(!/imageKey["'\s:=]+["'][a-z0-9/_.-]+\.(jpe?g|png|webp)/i.test(html), 'must never expose a raw storage key/filesystem path in the CardProduct edit form');
    const img = page.locator('.biawin-media-picker-field-preview img');
    if (await img.count() > 0) {
      const src = await img.first().getAttribute('src');
      assert(!!src && /^https?:\/\//.test(src), `expected a real resolved image URL, got "${src}"`);
    }
    assert(html.includes('مبلغ') || html.includes('قیمت'), 'expected the payable-price field on the CardProduct edit form');
    assert(html.includes('ارزش'), 'expected the card-value field on the CardProduct edit form');
  });
}

/** Stage 5.20 regression bar: uploading inside the Media Picker must not submit the outer Home content form. */
async function mediaPickerRegressionCheck(page: Page): Promise<void> {
  await step('Media Picker upload does not submit the outer Home form (Stage 5.20 regression)', async () => {
    // Route confirmed present in the admin app's own build output.
    await page.goto(`${ADMIN_ORIGIN}/home/service-banners/new`, { waitUntil: 'networkidle' });
    const urlBefore = page.url();

    // MediaPickerField.tsx: trigger button text "انتخاب تصویر" (nothing selected yet).
    const trigger = page.getByRole('button', { name: /انتخاب تصویر|تغییر تصویر/ });
    await trigger.first().click();

    // MediaPickerModal.tsx: toggle button "آپلود تصویر جدید" switches to the upload sub-view.
    await page.getByRole('button', { name: 'آپلود تصویر جدید' }).click();

    // MediaUploadForm.tsx: bare <input type="file">, no name attribute.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'qa-media-picker-probe.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });

    // MediaUploadForm.tsx submit button text "آپلود" (its OWN inner form's
    // submit — HomeFormShell.tsx:55-63's stopPropagation() is what should
    // keep this from also submitting the outer form).
    await page.getByRole('button', { name: /^آپلود$/ }).click();

    // Give the upload + any (incorrect) outer submit a moment to happen.
    await page.waitForTimeout(2000);

    assert(page.url() === urlBefore, `expected to stay on ${urlBefore}, ended up on ${page.url()} — outer form navigated, meaning it was submitted`);

    // HomeFormShell.tsx: outer submit button text "ذخیره" / "در حال ذخیره…" while saving.
    const outerSaveButton = page.getByRole('button', { name: /^(ذخیره|در حال ذخیره…)$/ });
    const outerSaveText = await outerSaveButton.first().textContent().catch(() => null);
    assert(
      outerSaveText === null || outerSaveText.trim() === 'ذخیره',
      `expected the outer form's save button to still read "ذخیره" (not saving), got "${outerSaveText}" — outer form was likely submitted`,
    );
  });
}

// ---------------------------------------------------------------------------
// Customer checks
// ---------------------------------------------------------------------------

/** Assumes `page` is already on the landing page. Real UI flow, real STAGING_TEST_AUTH fixed test phone/code — no API shortcut. */
async function performCustomerLogin(page: Page, label: string): Promise<boolean> {
  return (
    (await step(`${label} — STAGING_TEST_AUTH browser login (real UI flow)`, async () => {
      // LandingCenterCTA.tsx: aria-label="ورود یا ثبت نام در بیاوین".
      await page.getByRole('button', { name: 'ورود یا ثبت نام در بیاوین' }).click();

      // PhoneStep.tsx: placeholder "09xxxxxxxxx", submit button "دریافت کد ورود".
      const phoneInput = page.getByPlaceholder('09xxxxxxxxx');
      await phoneInput.waitFor({ timeout: 10000 });
      await phoneInput.fill('09121111111');
      await page.getByRole('button', { name: 'دریافت کد ورود' }).click();

      // OtpStep.tsx: segmented OtpInput (packages/ui) — no confirmed per-digit
      // selector, so focus the first visible text input in the OTP step and
      // type the fixed test code; segmented OTP inputs conventionally
      // auto-advance focus per keystroke.
      const otpContainer = page.locator('text=تأیید و ادامه').locator('..').locator('..');
      const firstOtpBox = otpContainer.locator('input').first();
      await firstOtpBox.waitFor({ timeout: 10000 });
      await firstOtpBox.click();
      await page.keyboard.type('123456', { delay: 80 });
      await page.getByRole('button', { name: 'تأیید و ادامه' }).click();

      await page.waitForURL(/\/home/, { timeout: 15000 });
      const hasToken = await page.evaluate(() => !!localStorage.getItem('biawin.accessToken'));
      assert(hasToken, 'expected biawin.accessToken in localStorage after customer login');
      return true;
    })) === true
  );
}

async function runCustomerChecks(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const issues = trackPageIssues(page);

  await step('Customer landing page renders (unauthenticated)', async () => {
    await page.goto(CUSTOMER_ORIGIN, { waitUntil: 'networkidle' });
    const { total, broken } = await assertNoBrokenImages(page);
    assert(broken.length === 0, `${broken.length}/${total} broken <img> elements on the landing page`);
  });
  await captureScreenshot(page, 'customer-landing-desktop', DESKTOP);

  const loggedIn = await performCustomerLogin(page, 'Customer');

  if (!loggedIn) {
    skip('Customer Home screenshots (authenticated)', 'customer browser login did not succeed — see the login step above for why; the API runner\'s STAGING_TEST_AUTH check (authenticated-qa-runner.ts) is the authoritative confirmation that the auth backend itself works, independent of this UI automation');
    await reportPageIssues('Customer (landing + login attempt)', issues);
    await context.close();
    return;
  }

  await step('Customer Home renders with CMS content, no broken images, no overflow', async () => {
    await page.waitForLoadState('networkidle');
    const { total, broken } = await assertNoBrokenImages(page);
    assert(total > 0, 'expected at least one <img> on the Home page (CMS-managed sections should render images)');
    assert(broken.length === 0, `${broken.length}/${total} broken <img> elements on Home: ${broken.slice(0, 3).join(', ')}`);
    assert(await assertNoHorizontalOverflow(page), 'unexpected horizontal overflow on Home (desktop)');
  });

  await captureScreenshot(page, 'customer-home-authenticated-desktop', DESKTOP);
  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(500);
  await step('Customer Home — no horizontal overflow at mobile width', async () => {
    assert(await assertNoHorizontalOverflow(page), 'unexpected horizontal overflow on Home (mobile)');
  });
  await captureScreenshot(page, 'customer-home-authenticated-mobile', MOBILE);
  await page.setViewportSize(DESKTOP);

  await runServicesModuleChecks(page, issues);
  await runCategoryLandingAndCardProductChecks(page, issues);

  await reportPageIssues('Customer (landing + login + Home + Services)', issues);
  await context.close();
}

// ---------------------------------------------------------------------------
// Services checks (SERVICES-R1.1 — docs/services-r1-staging-qa.md)
// ---------------------------------------------------------------------------

/**
 * Authenticated live QA for the SERVICES-R1 fidelity upgrade
 * (docs/services-r1-fidelity-report.md). Runs inside the same authenticated
 * `page`/context `runCustomerChecks` already established (real
 * STAGING_TEST_AUTH login above) — no separate login. Selectors match real
 * component source, same convention as the rest of this file: CategoryGrid.tsx
 * (category tiles: `<button><img alt="" /><span>{name}</span></button>`),
 * MethodFilterChips.tsx/Chip.tsx (`<button aria-pressed>{label}</button>`),
 * ServiceCard.tsx (`<button><strong>{title}</strong>...</button>` — the only
 * `<strong>` inside `<main>` on any Services page, since GlobalHeader's own
 * `<strong>بیاوین</strong>` logo sits outside `PageContainer`'s `<main>`),
 * ServiceSearchInput.tsx (SERVICES-R2: placeholder is dynamic per real
 * category, `` `جستجو در کارت‌های ${category.name}...` ``, mined from the
 * prototype's own `openServiceCategory()`),
 * DisabledPurchaseCTA.tsx (`aria-label="خرید — به‌زودی"`, text "خرید این
 * خدمت" + "به‌زودی").
 */
async function runServicesModuleChecks(page: Page, issues: PageIssues): Promise<void> {
  const snapshot = await step('Fetch real Category/Service snapshot via public API (cross-check baseline)', async () => {
    const s = await fetchServiceCatalogSnapshot();
    // The catalog is dynamic — Admin can add/remove Categories/Services at
    // any time (SERVICES-R5.17 Admin CMS), so a specific count (previously
    // hardcoded as 19/108) is not a stable invariant and WILL drift out of
    // sync with reality on its own, with no application defect involved
    // (confirmed live: a real run failed "expected 19 real categories, got
    // 20" purely because a 20th category was legitimately added). This
    // check instead validates the catalog is genuinely USABLE, via
    // business rules that hold regardless of how many rows exist:
    assert(s.categories.length > 0, 'expected at least one real category from the public catalog — got none');
    assert(s.services.length > 0, 'expected at least one real service from the public catalog — got none');
    // At least one real category must have at least one real service
    // loadable under it — otherwise every downstream category-flow check
    // in this file has nothing real to exercise.
    const categoryWithServices = s.categories.find((c) => s.services.some((sv) => sv.categoryId === c.id));
    assert(!!categoryWithServices, 'expected at least one real category to have at least one loadable real service, found none');
    return s;
  });
  if (!snapshot) {
    skip('Services module — all remaining checks', 'could not fetch the real Category/Service snapshot to cross-check against');
    return;
  }

  const byCategory = new Map<string, ServiceSnapshot[]>();
  for (const s of snapshot.services) {
    const list = byCategory.get(s.categoryId) ?? [];
    list.push(s);
    byCategory.set(s.categoryId, list);
  }
  // Services Catalog Reset (Sep 2026) — only ACTIVE categories are ever
  // visible in the /services grid (useServiceCatalog() filters client-side
  // — see the "بیشتر" step's own comment). Sorting/selecting from the
  // unfiltered snapshot risked `categoryMany`/`categoryFew` resolving to
  // one of the 9 now-hidden legacy categories (several of which have real
  // Services of their own, e.g. اتومبیل's 8) purely by service-count
  // coincidence — a real, non-deterministic risk (tie-break falls out of
  // raw API response order), not just a theoretical one. Every category
  // this flow clicks through by name must be a real, visible tile.
  const activeSnapshotCategories = snapshot.categories.filter((c) => c.active);
  const byCount = [...activeSnapshotCategories].sort(
    (a, b) => (byCategory.get(b.id)?.length ?? 0) - (byCategory.get(a.id)?.length ?? 0),
  );
  const categoryMany = byCount[0];
  const categoryFew = [...byCount].reverse().find((c) => (byCategory.get(c.id)?.length ?? 0) > 0) ?? byCount[byCount.length - 1];
  const categoryAsset = activeSnapshotCategories.find((c) => c.name === 'گردشگری') ?? categoryMany;
  const categoryAssetServices = byCategory.get(categoryAsset.id) ?? [];

  await step('Required categories this flow depends on are discoverable in the real catalog (count-agnostic)', async () => {
    // Not "exactly N categories exist" (brittle, drifts with real Admin
    // edits — see the snapshot-fetch step above) — instead, that every
    // category the rest of this file actually navigates to by name
    // (`categoryMany`/`categoryFew`, and the asset-mapped one with its
    // 'گردشگری' fallback) resolved to a REAL row with a usable id/name, so
    // the UI's own name-based selectors (`getByRole('button', {name:
    // category.name})`) have something real to find.
    for (const [label, cat] of [['categoryMany', categoryMany], ['categoryFew', categoryFew], ['categoryAsset', categoryAsset]] as const) {
      assert(!!cat && !!cat.id && !!cat.name, `expected ${label} to resolve to a real category with a usable id/name, got ${JSON.stringify(cat)}`);
    }
  });

  const tileIcons = page.locator('main button img[alt=""]');

  await step('Navigate to Services via bottom nav ("خدمات")', async () => {
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: 'خدمات', exact: true }).click();
    await page.waitForURL(/\/services$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  await step('Services List renders (promo banner + real category grid, no broken images)', async () => {
    const { total, broken } = await assertNoBrokenImages(page);
    assert(total > 0, 'expected at least the promo banner + category icon images on the Services List');
    assert(broken.length === 0, `${broken.length}/${total} broken <img> elements on Services List: ${broken.slice(0, 3).join(', ')}`);
    assert(await assertNoHorizontalOverflow(page), 'unexpected horizontal overflow on Services List (desktop)');
  });

  await step('Services List shows exactly the first 11 real categories by default', async () => {
    // SERVICES-R1.2 finding: a real run counted 0 tiles here — not an app
    // defect, a QA race. `useServiceCatalog()`'s categories fetch is a
    // client-side effect that fires AFTER the client-side route transition
    // `networkidle` above already resolved; the grid shows 12 skeleton
    // blocks (no <img>) until that fetch's state update lands. Waiting for
    // the first real tile closes that race without weakening the assertion
    // — later steps ("بیشتر") proved the same run's data DID load correctly.
    // Services Catalog Reset (Sep 2026) — GET /categories returns ALL
    // Categories (active and hidden alike, confirmed: CategoriesService.
    // list() has no active filter); useServiceCatalog() filters to
    // `.active` client-side before CategoryGrid ever renders a tile (see
    // that hook's own source) — so the real expected/rendered count is
    // the ACTIVE subset, not the raw snapshot length. The 9 legacy
    // categories this stage hid are correctly excluded from what should
    // ever be visible here.
    const activeCategories = snapshot.categories.filter((c) => c.active);
    await tileIcons.first().waitFor({ timeout: 10000 });
    const count = await tileIcons.count();
    assert(count === Math.min(11, activeCategories.length), `expected ${Math.min(11, activeCategories.length)} visible category tiles, got ${count}`);
  });

  await captureScreenshot(page, 'services-list-collapsed-desktop', DESKTOP);
  for (const vp of RESPONSIVE_WIDTHS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    await step(`Services List (collapsed) — no horizontal overflow at ${vp.width}px`, async () => {
      assert(await assertNoHorizontalOverflow(page), `unexpected horizontal overflow on Services List at ${vp.width}px`);
    });
    await captureScreenshot(page, `services-list-collapsed-${vp.width}`, vp);
  }
  await page.setViewportSize(DESKTOP);

  const moreButton = page.getByRole('button', { name: 'بیشتر', exact: true });
  const hasMore = (await moreButton.count()) > 0;
  if (hasMore) {
    await step('"بیشتر" reveals all real ACTIVE categories with no duplicates, no layout break', async () => {
      await moreButton.click();
      await page.waitForTimeout(300);
      const count = await tileIcons.count();
      // Services Catalog Reset (Sep 2026) — see the collapsed-count step's
      // own comment above: only the ACTIVE subset is ever rendered.
      const activeCategories = snapshot.categories.filter((c) => c.active);
      assert(count === activeCategories.length, `expected ${activeCategories.length} category tiles after expanding, got ${count}`);
      assert((await page.getByRole('button', { name: 'کمتر', exact: true }).count()) === 1, 'expected the toggle button to read "کمتر" once expanded');
      assert(await assertNoHorizontalOverflow(page), 'unexpected horizontal overflow after expanding the category grid');
    });

    await captureScreenshot(page, 'services-list-expanded-desktop', DESKTOP);
    for (const vp of RESPONSIVE_WIDTHS) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(300);
      await captureScreenshot(page, `services-list-expanded-${vp.width}`, vp);
    }
    await page.setViewportSize(DESKTOP);

    await step('"کمتر" collapses back to 11 categories', async () => {
      await page.getByRole('button', { name: 'کمتر', exact: true }).click();
      await page.waitForTimeout(300);
      const count = await tileIcons.count();
      const activeCategories = snapshot.categories.filter((c) => c.active);
      assert(count === Math.min(11, activeCategories.length), `expected 11 visible category tiles after collapsing, got ${count}`);
    });
  } else {
    const activeCategories = snapshot.categories.filter((c) => c.active);
    skip('"بیشتر"/"کمتر" toggle', `only ${activeCategories.length} real ACTIVE categories exist — at or under the 11-item default, no toggle rendered`);
  }

  // Customer journey — THREE levels: Services Home -> Category Landing ->
  // CardProduct Detail. `Service` is an internal entity, not a page:
  // `/services/{categoryId}` (the former Service-grid Category View) and
  // `/services/{categoryId}/{serviceId}` (the former Service Detail, which
  // listed a second "محصولات این خدمت" card-selection step) no longer render
  // anything of their own — they replace themselves with the Category
  // Landing. The Category Landing itself, its CardProduct grid, search,
  // filters and the direct click-through are exercised by
  // `runCategoryLandingAndCardProductChecks` below.
  const landingPath = categoryAsset.slug ? `/categories/${categoryAsset.slug}` : null;
  if (landingPath) {
    await step(`Legacy route /services/{categoryId} is an alias, not a page — it replaces itself with ${landingPath}`, async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${categoryAsset.id}`, { waitUntil: 'networkidle' });
      await page.waitForURL(new RegExp(`${landingPath}$`), { timeout: 15000 });
      await page.getByRole('heading', { level: 1, name: categoryAsset.name, exact: true }).waitFor({ timeout: 10000 });
      assert((await page.getByText('محصولات این خدمت').count()) === 0, 'the former Service-level card list must not exist anywhere in the journey');
    });

    const aliasService = categoryAssetServices[0];
    if (aliasService) {
      await step(`Legacy Service Detail route /services/{categoryId}/{serviceId} is not a customer page — it lands on ${landingPath}`, async () => {
        issues.markNavigationAttempt();
        await page.goto(`${CUSTOMER_ORIGIN}/services/${categoryAsset.id}/${aliasService.id}`, { waitUntil: 'networkidle' });
        await page.waitForURL(new RegExp(`${landingPath}$`), { timeout: 15000 });
        await page.getByRole('heading', { level: 1, name: categoryAsset.name, exact: true }).waitFor({ timeout: 10000 });
        assert((await page.getByText('محصولات این خدمت').count()) === 0, 'the former Service Detail must not render its card list');
        assert((await page.getByText('مشخصات همین خدمت').count()) === 0, 'the former Service Detail summary must not render');
      });
    } else {
      skip('Legacy Service Detail route alias', `"${categoryAsset.name}" has no real service to build a legacy URL from`);
    }
  } else {
    skip('Legacy route aliases', `"${categoryAsset.name}" has no Landing slug`);
  }

  // The merchant page is not reachable from any customer link any more (it
  // was linked only from the removed Service Detail), but the route still
  // exists — its data-integrity guard is kept, not silently dropped.
  const merchantProbe = categoryAssetServices[0];
  if (merchantProbe) {
    await step('SERVICES-R4 data integrity — a real Service + Category pair with a NON-EXISTENT Merchant UUID renders not-found', async () => {
      issues.markNavigationAttempt();
      const fakeMerchantId = '00000000-0000-4000-8000-000000000000';
      await page.goto(`${CUSTOMER_ORIGIN}/services/${merchantProbe.categoryId}/${merchantProbe.id}/${fakeMerchantId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const html = await page.content();
      assert(html.includes('این فروشنده یافت نشد.'), 'expected the Merchant not-found state for a real service + a non-existent merchant id');
    });
  }

  await step('Home smoke after Services navigation — CMS content still renders, no state corruption', async () => {
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: 'بیاوین', exact: true }).click();
    await page.waitForURL(/\/home/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    const { total, broken } = await assertNoBrokenImages(page);
    assert(total > 0, 'expected Home CMS content to still render images after navigating through Services');
    assert(broken.length === 0, `${broken.length}/${total} broken images on Home after Services navigation`);
    assert(await assertNoHorizontalOverflow(page), 'unexpected horizontal overflow on Home after Services navigation');
  });
}

// ---------------------------------------------------------------------------
// SERVICES-R5.23 — Category Landing / CategoryCard / CardProduct Detail
// ---------------------------------------------------------------------------

/**
 * SERVICES-R5.24 root-cause fix — every backend response, success OR error
 * (including a 429 from the global `ThrottlerGuard`: 100 req/60s/IP,
 * `backend/src/app.module.ts`), is wrapped as either `{success:true,
 * data}` or `{success:false, error}` by `ResponseInterceptor`/
 * `HttpExceptionFilter` — never a bare `{data: ...}`. The R5.23 version of
 * this file's snapshot fetches assumed `{data: {items}}` unconditionally
 * and crashed with "Cannot read properties of undefined (reading
 * 'items')" the moment any one of them got a 429 instead of a 200 — which
 * the OLD `fetchCardProductSnapshot` (below) made likely: it issued one
 * `/cards?serviceId=X` request PER real Service (worst case ~500
 * sequential requests just to find a single real CardProduct), easily
 * exceeding the throttle on its own within one run. Every fetch in this
 * function now goes through this helper, which checks `success` before
 * ever touching `.data` and returns `null` on failure instead of
 * throwing — a real 429 now fails one `step()` with a clear message,
 * never crashes the whole script.
 */
async function fetchApi<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_ORIGIN}${path}`);
  let json: { success: boolean; data?: T; error?: { code: string; message: string } };
  try {
    json = await res.json();
  } catch {
    return null;
  }
  if (!json.success || json.data === undefined) {
    console.warn(`[browser-qa] ${path} -> HTTP ${res.status}${json?.error ? ` ${json.error.code}: ${json.error.message}` : ''}`);
    return null;
  }
  return json.data;
}

/**
 * The API rate-limits every client with a fixed window — 100 requests / 60s
 * / IP (`ThrottlerGuard`, backend/src/app.module.ts) — and a real page load
 * is not small: Home ≈ 40 requests, Services Home ≈ 17, plus images. The
 * Services journey checks below load whole pages back to back, so between
 * the heavy phases this waits out one full window. It matters because a 429
 * on a media image is rejected by the guard BEFORE the media route runs, so
 * it carries helmet's default `Cross-Origin-Resource-Policy: same-origin` and
 * reaches the browser as `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` — a
 * failure that looks like a CORS/CORP defect but is only the limiter. Pacing
 * only: no assertion is weakened or skipped.
 */
async function waitForRateLimitWindow(): Promise<void> {
  await step('Pacing — wait out the API rate-limit window (100 requests / 60s / IP) between page-heavy phases', async () => {
    await new Promise((resolve) => setTimeout(resolve, 61_000));
  });
}

const toman = (rial: number): string => `${Math.floor(rial / 10).toLocaleString('en-US')} تومان`;
const toFaDigits = (n: number): string => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const CARD_TYPE_SHORT: Record<string, string> = {
  CREDIT_CARD: 'اعتباری',
  DISCOUNT_CARD: 'تخفیفی',
  SUBSCRIPTION: 'اشتراک',
  VOUCHER: 'ووچر',
  INSTALLMENT_CARD: 'اقساطی',
};

/** Every real ACTIVE CardProduct, paged (the public `GET /cards` is already ACTIVE-only server-side). */
async function fetchAllActiveCards(): Promise<CardProductSnapshot[] | null> {
  const out: CardProductSnapshot[] = [];
  for (let p = 0; p < 5; p++) {
    const data = await fetchApi<{ items: CardProductSnapshot[] }>(`/api/v1/cards?skip=${p * 100}&limit=100`);
    if (!data) return null;
    out.push(...data.items);
    if (data.items.length < 100) break;
  }
  return out;
}

/**
 * The Services customer journey has THREE levels — Services Home, Category
 * Landing, CardProduct Detail — and this exercises the last two, live and in
 * a real browser, against a cross-check of the real public API:
 *
 *   Category Landing (`/categories/{slug}`): prototype `page-service-category`
 *   — header, hero, search, type filters, this category's real CardProducts,
 *   info strip. The product list must be EXACTLY the category's own real
 *   cards (`GET /cards?categoryId=` semantics, cross-checked against the
 *   global list so a leaked card from another category would be caught).
 *
 *   Choosing a CardProduct opens THAT card's detail page DIRECTLY — the
 *   recorded navigation must contain no `/services/{cat}/{service}` (Service
 *   Detail) hop, and the detail page must offer no second card to pick.
 *
 * Entirely count-agnostic against a live snapshot (no hardcoded catalog
 * size), the discipline every check in this file has followed since
 * commit 563d319. Selectors match real component source:
 * `CardProductTile.tsx` (`.cl-fc-hit`, a transparent full-tile `<button>`
 * whose accessible name is the card's title), `CardProductDetailHero.tsx`
 * (`<h1>{title}</h1>`), `CardProductBuyBar.tsx`.
 */
async function runCategoryLandingAndCardProductChecks(page: Page, issues: PageIssues): Promise<void> {
  await waitForRateLimitWindow();
  const data = await step('Fetch the real Categories, Services and ACTIVE CardProducts (public API cross-check baseline)', async () => {
    const catData = await fetchApi<{ items: CategorySnapshot[] }>('/api/v1/categories?limit=100');
    const cards = await fetchAllActiveCards();
    if (!catData || !cards) throw new Error('could not fetch the real catalog snapshot (see console for the underlying HTTP/error detail)');
    const catalog = await fetchServiceCatalogSnapshot();
    return { categories: catData.items.filter((c) => c.active && !!c.slug), cards, services: catalog.services };
  });
  if (!data) {
    skip('Category Landing / CardProduct Detail — all checks', 'could not fetch the real catalog snapshot to cross-check against');
    return;
  }

  const serviceById = new Map(data.services.map((s) => [s.id, s]));
  const cardsByCategory = new Map<string, CardProductSnapshot[]>();
  for (const c of data.cards) {
    const owner = serviceById.get(c.serviceId);
    if (!owner) continue;
    cardsByCategory.set(owner.categoryId, [...(cardsByCategory.get(owner.categoryId) ?? []), c]);
  }
  const isPurchasable = (c: CardProductSnapshot) => c.journeyType === 'PURCHASE' && c.priceAmount != null && c.priceAmount > 0;
  const categoriesWithCards = data.categories.filter((c) => (cardsByCategory.get(c.id)?.length ?? 0) > 0);
  if (categoriesWithCards.length === 0) {
    skip('Category Landing / CardProduct Detail — all checks', 'no active, slugged real Category currently has a real ACTIVE CardProduct — nothing to choose yet; a real content state, not a QA gap');
    return;
  }

  const category = categoriesWithCards.find((c) => cardsByCategory.get(c.id)!.some(isPurchasable)) ?? categoriesWithCards[0];
  const categoryCards = cardsByCategory.get(category.id)!;
  const cardProduct = categoryCards.find(isPurchasable) ?? categoryCards[0];
  const service = serviceById.get(cardProduct.serviceId)!;
  const landingPath = `/categories/${category.slug}`;
  const detailPathRe = new RegExp(`/services/${category.id}/${service.id}/cards/${cardProduct.id}$`);
  const tiles = page.locator('.cl-fc-hit');
  const searchPlaceholder = `جستجو در کارت‌های ${category.name}...`;
  const PROTOTYPE_EMPTY_COPY = 'موردی با این عبارت پیدا نشد. عبارت دیگری جستجو کنید.';

  // ---- Category Landing -------------------------------------------------

  await step(`Category Landing renders the real hero for "${category.name}" (${landingPath})`, async () => {
    issues.markNavigationAttempt();
    await page.goto(`${CUSTOMER_ORIGIN}${landingPath}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1, name: category.name, exact: true }).waitFor({ timeout: 10000 });
    const html = await page.content();
    assert(html.includes(category.description), 'expected the real category description in the Category Landing hero');
    assert(html.includes('کارت‌های خدمات بیاوین'), 'expected the prototype\'s hero label');
    // Media architecture: never a raw storage key/filesystem path leaking into rendered HTML.
    assert(!html.includes('categories/') || !/categories\/[^"]+\.(jpe?g|png|webp)/i.test(html), 'must never reference the reference-only categories/ directory as a runtime image path');
  });

  await step('Category Landing header: back + share controls and the "کارت‌های {category}" caption', async () => {
    assert((await page.getByRole('button', { name: 'بازگشت' }).count()) === 1, 'expected exactly one back control');
    assert((await page.getByRole('button', { name: 'اشتراک‌گذاری' }).count()) === 1, 'expected exactly one share control');
    assert((await page.locator('.svc-header-title').innerText()).trim() === `کارت‌های ${category.name}`, 'expected the header caption "کارت‌های {category}"');
  });

  await step('Category Landing tools: a category-specific search field and filter chips built from the card types that really exist', async () => {
    await page.getByPlaceholder(searchPlaceholder).waitFor({ timeout: 5000 });
    const types = [...new Set(categoryCards.map((c) => c.cardType))];
    assert((await page.getByRole('button', { name: 'همه', exact: true }).count()) === 1, 'expected the "همه" filter chip');
    for (const t of types) {
      assert((await page.getByRole('button', { name: CARD_TYPE_SHORT[t], exact: true }).count()) === 1, `expected a "${CARD_TYPE_SHORT[t]}" filter chip for the real ${t} card(s)`);
    }
    assert(!(await page.content()).includes('ترکیبی'), 'the prototype-only "ترکیبی" chip must not render — no real card type backs it');
  });

  await step('Category Landing products: EXACTLY this category\'s real CardProducts, each with its real price — no unrelated card', async () => {
    await tiles.first().waitFor({ timeout: 10000 });
    const labels = ((await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))) as string[]).sort();
    const expected = categoryCards.map((c) => c.title).sort();
    assert(JSON.stringify(labels) === JSON.stringify(expected), `expected exactly the category's cards ${JSON.stringify(expected)}, rendered ${JSON.stringify(labels)}`);
    for (const foreign of data.cards.filter((c) => !categoryCards.some((x) => x.id === c.id))) {
      assert(!labels.includes(foreign.title), `"${foreign.title}" belongs to another category and must not appear under "${category.name}"`);
    }
    const html = await page.content();
    assert(html.includes(`${toFaDigits(categoryCards.length)} کارت`), 'expected the Persian card-count pill');
    for (const c of categoryCards) {
      if (c.priceAmount != null) assert(html.includes(toman(c.priceAmount)), `expected the real price ${toman(c.priceAmount)} on "${c.title}"`);
    }
    assert(html.includes('پرداخت به بیاوین'), 'expected the payable-price label on each card');
    assert(html.includes('کارت متناسب با نیازتان را انتخاب کنید'), 'expected the prototype\'s info strip');
    assert(!html.includes('محصولات این خدمت'), 'no Service-level card list may exist in the journey');
    const { broken } = await assertNoBrokenImages(page);
    assert(broken.length === 0, `broken images on the "${category.name}" Category Landing`);
  });

  await captureScreenshot(page, 'category-landing-desktop', DESKTOP);
  for (const vp of RESPONSIVE_WIDTHS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    await step(`Category Landing — no horizontal overflow at ${vp.width}px`, async () => {
      assert(await assertNoHorizontalOverflow(page), `unexpected horizontal overflow on Category Landing at ${vp.width}px`);
    });
    await captureScreenshot(page, `category-landing-${vp.width}`, vp);
  }
  await page.setViewportSize(DESKTOP);

  await step('Category search works over this category\'s cards only', async () => {
    const box = page.getByPlaceholder(searchPlaceholder);
    await box.fill(cardProduct.title.slice(0, Math.min(4, cardProduct.title.length)));
    await page.waitForTimeout(300);
    assert((await page.getByRole('button', { name: cardProduct.title, exact: true }).count()) === 1, `expected searching a prefix of "${cardProduct.title}" to keep that card visible`);
    await box.fill('عبارت-جستجوی-نامنطبق-QA');
    await page.waitForTimeout(300);
    assert((await tiles.count()) === 0, 'expected no cards for a non-matching search');
    assert((await page.content()).includes(PROTOTYPE_EMPTY_COPY), 'expected the prototype\'s no-match copy');
    await box.fill('');
    await page.waitForTimeout(300);
    assert((await tiles.count()) === categoryCards.length, 'expected clearing the search to restore every card');
  });

  await step('Category type filter narrows to the chosen type and "همه" restores every card', async () => {
    const label = CARD_TYPE_SHORT[cardProduct.cardType];
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(300);
    assert((await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed')) === 'true', `expected the "${label}" chip to be pressed`);
    assert((await tiles.count()) === categoryCards.filter((c) => c.cardType === cardProduct.cardType).length, `expected only the ${cardProduct.cardType} cards after filtering`);
    await page.getByRole('button', { name: 'همه', exact: true }).click();
    await page.waitForTimeout(300);
    assert((await tiles.count()) === categoryCards.length, 'expected "همه" to restore every card');
  });

  await step('Bottom navigation works from the Category Landing (بیاوین -> Home, back returns to the Landing)', async () => {
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: 'بیاوین', exact: true }).click();
    await page.waitForURL(/\/home/, { timeout: 15000 });
    issues.markNavigationAttempt();
    await page.goBack({ waitUntil: 'networkidle' });
    assert(new RegExp(`${landingPath}$`).test(page.url()), `expected to return to ${landingPath}, got ${page.url()}`);
    await tiles.first().waitFor({ timeout: 10000 });
  });

  // ---- Direct click-through: Category -> CardProduct Detail -------------

  const visited: string[] = [];
  const onNavigated = (frame: Frame) => {
    if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
  };
  page.on('framenavigated', onNavigated);
  await step(`Choosing "${cardProduct.title}" opens ITS detail page DIRECTLY — no Service page, no second card-selection step`, async () => {
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: cardProduct.title, exact: true }).click();
    await page.waitForURL(detailPathRe, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { level: 1, name: cardProduct.title, exact: true }).waitFor({ timeout: 10000 });
    const serviceLevel = new RegExp(`^/services/${category.id}/${service.id}/?$`);
    assert(!visited.some((u) => serviceLevel.test(u)), `the journey visited a Service-level page: ${visited.join(' -> ')}`);
    assert(visited.filter((u) => u !== landingPath).length === 1, `expected exactly ONE navigation from the Landing (to the card detail), got: ${visited.join(' -> ')}`);
  });
  page.off('framenavigated', onNavigated);

  // ---- CardProduct Detail ------------------------------------------------

  const isPurch = isPurchasable(cardProduct);
  await step(`CardProduct Detail describes ONLY "${cardProduct.title}": correct title, price, value, category — and no second card to choose (${isPurch ? 'purchasable, CTA enabled' : 'CTA disabled'})`, async () => {
    const html = await page.content();
    assert(html.includes(category.name), `expected the real owning category "${category.name}" on the detail page`);
    if (cardProduct.priceAmount != null) assert(html.includes(toman(cardProduct.priceAmount)), `expected the real priceAmount ${toman(cardProduct.priceAmount)}`);
    if (cardProduct.valueAmount != null) assert(html.includes(toman(cardProduct.valueAmount)), `expected the real valueAmount ${toman(cardProduct.valueAmount)}`);
    for (const other of data.cards.filter((c) => c.id !== cardProduct.id)) {
      assert((await page.getByRole('button', { name: other.title, exact: true }).count()) === 0, `"${other.title}" must not be offered as a selectable card on "${cardProduct.title}"'s detail page`);
    }
    assert((await page.locator('.cl-fc').count()) === 0, 'no card tile/grid may render inside CardProduct Detail');
    assert(!html.includes('محصولات این خدمت'), 'no Service-level card list may render inside CardProduct Detail');
    assert(html.includes('خرید کارت'), 'expected the real card-purchase CTA text');
    if (isPurch) {
      assert(await page.getByRole('button', { name: 'خرید کارت', exact: true }).isEnabled(), 'expected the real, enabled card purchase CTA for a genuinely purchasable CardProduct');
    } else {
      assert(html.includes('به‌زودی'), 'expected the "به‌زودی" caption on the disabled CTA');
      assert(await page.getByRole('button', { name: 'خرید کارت — به‌زودی' }).isDisabled(), 'expected the card purchase CTA to be disabled');
    }
    const { broken } = await assertNoBrokenImages(page);
    assert(broken.length === 0, `broken images on CardProduct Detail for "${cardProduct.title}"`);
  });

  await captureScreenshot(page, 'card-product-detail-desktop', DESKTOP);
  for (const vp of RESPONSIVE_WIDTHS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    await step(`CardProduct Detail — no horizontal overflow at ${vp.width}px`, async () => {
      assert(await assertNoHorizontalOverflow(page), `unexpected horizontal overflow on CardProduct Detail at ${vp.width}px`);
    });
    await captureScreenshot(page, `card-product-detail-${vp.width}`, vp);
  }
  await page.setViewportSize(DESKTOP);

  await step('CardProduct Detail header: share sends this card\'s title and URL', async () => {
    await page.evaluate(() => {
      (window as unknown as { __shared: unknown }).__shared = null;
      Object.defineProperty(navigator, 'share', {
        value: async (d: unknown) => {
          (window as unknown as { __shared: unknown }).__shared = d;
        },
        configurable: true,
      });
    });
    await page.getByRole('button', { name: 'اشتراک‌گذاری' }).click();
    const shared = (await page.evaluate(() => (window as unknown as { __shared: { title?: string; url?: string } | null }).__shared)) ?? {};
    assert(shared.title === cardProduct.title && shared.url === page.url(), `expected share to carry the card's title and URL, got ${JSON.stringify(shared)}`);
  });

  await step('CardProduct Detail header: back returns to the Category Landing this card was chosen from — then choosing it again reopens the same detail', async () => {
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: 'بازگشت' }).click();
    await page.waitForURL(new RegExp(`${landingPath}$`), { timeout: 15000 });
    await tiles.first().waitFor({ timeout: 10000 });
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: cardProduct.title, exact: true }).click();
    await page.waitForURL(detailPathRe, { timeout: 15000 });
    await page.getByRole('heading', { level: 1, name: cardProduct.title, exact: true }).waitFor({ timeout: 10000 });
  });

  if (!isPurch) {
    skip('SERVICES-R5.26 Purchase Flow click-through', `"${cardProduct.title}" is not purchasable (journeyType=${cardProduct.journeyType}, priceAmount=${cardProduct.priceAmount}) — no genuinely purchasable CardProduct exists on this environment today to click through the real flow; this is a real content state, not a QA gap`);
  } else {
    /**
     * SERVICES-R5.26 — the real Purchase Flow, end to end, through the actual
     * rendered UI (not an API shortcut): CTA -> PurchaseSheet -> POST /orders
     * -> redirect -> `/purchase/[orderId]`. Known, accepted side effect: one
     * real, persisted, harmless `pending` Order for the STAGING_TEST_AUTH
     * customer account — `Order` has no delete endpoint, and a `pending`
     * Order has zero financial/fulfillment side effects of its own. Left in
     * place intentionally rather than faked away.
     */
    await step('SERVICES-R5.26 clicking the real CTA opens the Purchase confirmation sheet with the correct amount', async () => {
      await page.getByRole('button', { name: 'خرید کارت', exact: true }).click();
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      const sheetText = await page.getByRole('dialog').innerText();
      assert(sheetText.includes('تأیید خرید'), 'expected the Purchase Sheet header "تأیید خرید"');
      assert(sheetText.includes('مبلغ پرداختی'), 'expected the payable-price label "مبلغ پرداختی"');
      assert(sheetText.includes('ارزش کارت'), 'expected the card-value label "ارزش کارت", kept visually distinct from the payable price');
      assert(sheetText.includes(toman(cardProduct.priceAmount!)), `expected the sheet to show the real payable amount ${toman(cardProduct.priceAmount!)}`);
    });

    await captureScreenshot(page, 'card-product-purchase-sheet-desktop', DESKTOP);

    await step('SERVICES-R5.26 confirming the purchase creates a real Order and lands on the ready-for-payment page — no gateway, no fake payment-success state', async () => {
      issues.markNavigationAttempt();
      await page.getByRole('button', { name: 'تأیید و ادامه پرداخت', exact: true }).click();
      await page.waitForURL(/\/purchase\/[^/]+$/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      // The result page fetches GET /orders/:id client-side and renders a
      // loading skeleton first — wait for the real result heading itself.
      await page.getByText('سفارش شما ثبت شد و آماده پرداخت است').waitFor({ timeout: 10000 });
      const html = await page.content();
      assert(html.includes('مبلغ قابل پرداخت'), 'expected the payable-amount fact on the result page');
      assert(!html.includes('پرداخت با موفقیت'), 'must never show a fake payment-success message — no gateway exists yet (R5.27)');
      const { broken } = await assertNoBrokenImages(page);
      assert(broken.length === 0, 'broken images on the Purchase result page');
    });

    await captureScreenshot(page, 'card-product-purchase-result-desktop', DESKTOP);
  }

  // ---- Ownership + cold URL + empty category (each a fresh goto) ---------

  const otherCategory = data.categories.find((c) => c.id !== category.id);
  if (otherCategory) {
    await step('Ownership — the same CardProduct under a DIFFERENT category\'s URL renders not-found, never the mismatched card', async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${otherCategory.id}/${service.id}/cards/${cardProduct.id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const html = await page.content();
      assert(html.includes('این کارت محصول یافت نشد.'), 'expected the not-found state for a category/card mismatch');
      assert((await page.getByRole('heading', { level: 1, name: cardProduct.title, exact: true }).count()) === 0, 'must NOT render the card under another category\'s URL');
    });
  } else {
    skip('Ownership — wrong-category card URL', 'only one active, slugged real category exists');
  }

  const otherService = data.services.find((s) => s.id !== service.id);
  if (otherService) {
    await step('Ownership — the same CardProduct under a DIFFERENT service\'s URL renders not-found', async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${otherService.categoryId}/${otherService.id}/cards/${cardProduct.id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      assert((await page.content()).includes('این کارت محصول یافت نشد.'), 'expected the not-found state for a service/card mismatch');
    });
  }

  await step('CardProduct Detail — cold direct URL (bookmark/share, no click, no history) renders the same card', async () => {
    issues.markNavigationAttempt();
    await page.goto(`${CUSTOMER_ORIGIN}/services/${category.id}/${service.id}/cards/${cardProduct.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1, name: cardProduct.title, exact: true }).waitFor({ timeout: 10000 });
    assert((await page.content()).includes(category.name), 'expected the real category on a cold direct URL');
  });

  const emptyCategory = data.categories.find((c) => (cardsByCategory.get(c.id)?.length ?? 0) === 0);
  if (emptyCategory) {
    await step(`Category Landing for "${emptyCategory.name}" (no real CardProduct) shows the honest empty state, never a fabricated card`, async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/categories/${emptyCategory.slug}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1, name: emptyCategory.name, exact: true }).waitFor({ timeout: 10000 });
      await page.getByText('در حال حاضر کارتی برای این دسته‌بندی ثبت نشده است.').waitFor({ timeout: 10000 });
      assert((await page.locator('.cl-fc').count()) === 0, 'expected no card tiles for a category with no real CardProduct');
    });
  }
}


// ---------------------------------------------------------------------------
// SERVICES-R1.4 — isolated back-navigation reproduction
// ---------------------------------------------------------------------------

/**
 * SERVICES-R1.7 CLOSURE: this isolated sequence now PASSES against real
 * staging — a fresh, minimal-history context proves `/services` -> category
 * -> [discovery card] -> back -> (same page) -> back -> `/services` all
 * resolve correctly. Classification: QA HISTORY POLLUTION / invalid
 * long-running assertion, NOT an application navigation defect —
 * confirmed, not assumed. No `router.push`/`router.back`/redirect code in
 * apps/web/src/app/services/** or apps/web/src/components/shell/** was
 * changed as a result; none was warranted. This function is now the
 * permanent, authoritative back-navigation test (see the comment on the
 * removed second `goBack()` assertion in `runServicesModuleChecks`).
 *
 * R5.26.2 QA forensic fix (Sep 2026) — the middle destination changed from
 * `/services/{categoryId}` (Service browse grid) to `/categories/{slug}`
 * (Category Landing, the real CategoryCard discovery-card experience) —
 * commit c4bab52 made that the canonical first click-through from
 * `/services` (apps/web/src/app/services/page.tsx's `handleSelectCategory`
 * now prefers `/categories/${category.slug}` whenever a slug exists). The
 * history-length/pollution finding below is untouched by that — it was
 * never about WHICH route the middle page was, only about whether an
 * extra history entry existed; this function's URL assertions were simply
 * updated to match the new, approved destination.
 *
 * History of how this was reached, kept for context:
 *
 * A real run against fcd90a3 STILL failed "Browser back from Category View
 * returns to Services List" after SERVICES-R1.2's history-pollution fix
 * (which moved the "many/few services" light-visit loop to run after this
 * exact sequence, not before it) — landing on the SAME category URL
 * (گردشگری's own real UUID) both times, not a different one. That rules
 * out the light-visit loop as the (sole) cause and means the extra history
 * entry exists even in the "clean" services -> category -> detail path.
 *
 * Router/Link inspection (this session, before writing this function):
 * grepped the whole of apps/web/src for router.push/replace/redirect/
 * window.location/history.*State. Services List -> Category is exactly one
 * `router.push(...)` (apps/web/src/app/services/page.tsx:32); Category ->
 * Service Detail is exactly one `router.push(...)`
 * (apps/web/src/app/services/[categoryId]/page.tsx:55). `AuthGuard` only
 * ever calls `router.replace` (never `push`, so it can't ADD an entry) and
 * only when `shouldRedirect` is true — false for an authenticated session,
 * so it does not fire on these routes. No other push/replace/redirect
 * exists anywhere in the Services or shell code. Nothing in application
 * source explains a doubled history entry.
 *
 * This function is the task's own prescribed isolation protocol: a FRESH
 * context/page, freshly authenticated, starting at /services with zero
 * prior Services history, doing exactly click-category -> click-service ->
 * back -> back with NO page.goto() anywhere in the sequence — and logging
 * `history.length` + the real URL at every step into the report (not just
 * console.log) so the raw evidence is auditable, not asserted.
 *
 * SERVICES-R1.5 finding: the FIRST version of this function reused
 * `performCustomerLogin()` (the real click-through OTP UI flow) for the
 * fresh context and timed out waiting for the OTP input to appear. This
 * was NOT a selector bug — `performCustomerLogin` is the exact same code
 * `runCustomerChecks` uses successfully earlier in the SAME run. The real
 * cause, confirmed by reading `backend/src/modules/auth/otp.service.ts`:
 * `issue()` enforces a per-phone "at most one live code at a time" resend
 * lock (`otp:resend-lock:${phone}`, TTL = OTP_TTL_SECONDS, default 120s) —
 * requesting a SECOND code for the fixed STAGING_TEST_AUTH phone
 * (09121111111) within that window throws HTTP 429 ("کد قبلی هنوز معتبر
 * است"), so the phone-step submit never reaches the OTP screen and the
 * locator genuinely has nothing to wait for. `runCustomerChecks`'s login
 * had already consumed that phone's resend slot moments earlier in the
 * same run. Clicking through the OTP UI a second time was never going to
 * work reliably regardless of selector.
 *
 * The fix uses the SAME bypass `verify()` already grants test credentials
 * (see that file: `testBypassEnabled && phone === DEV_TEST_PHONE && code
 * === DEV_TEST_CODE` returns immediately, with NO dependency on a prior
 * `issue()`/send call at all) — exactly how
 * `backend/scripts/staging-qa/authenticated-qa-runner.ts`'s own
 * `customerAuthCheck()` already authenticates, calling `/otp/verify`
 * directly without ever calling `/otp/request` first. Calling it here via
 * `page.request` (Playwright's own HTTP client, not page JS — no CORS
 * concerns) gets a REAL backend-issued token pair without touching the
 * resend-locked send endpoint at all, then seeds `localStorage` with it
 * before the very next navigation, which is exactly when `AuthProvider`'s
 * mount effect (apps/web/src/lib/auth/auth-context.tsx) reads it. This is
 * not a fake session — it's the same token shape a real login produces,
 * obtained through the same documented test-mode bypass, just without
 * re-triggering a UI flow already exercised (and rate-limited) elsewhere
 * in this run.
 */
async function runBackNavigationIsolationCheck(browser: Browser): Promise<void> {
  await waitForRateLimitWindow();
  const snapshot = await fetchServiceCatalogSnapshot().catch(() => null);
  if (!snapshot) {
    skip('Back-nav isolation — full sequence', 'could not fetch the real Category/Service snapshot to pick a category/service from');
    return;
  }
  // The journey is Services Home -> Category Landing -> CardProduct Detail, so
  // the category to click must be one that really has a CardProduct to choose.
  const allCards = await fetchAllActiveCards();
  if (!allCards) {
    skip('Back-nav isolation — full sequence', 'could not fetch the real ACTIVE CardProducts to pick a category from');
    return;
  }
  const serviceCategory = new Map(snapshot.services.map((sv) => [sv.id, sv.categoryId]));
  const byCategoryCount = new Map<string, number>();
  for (const c of allCards) {
    const categoryId = serviceCategory.get(c.serviceId);
    if (categoryId) byCategoryCount.set(categoryId, (byCategoryCount.get(categoryId) ?? 0) + 1);
  }

  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const issues = trackPageIssues(page);
  const trace: string[] = [];
  const recordStep = async (label: string) => {
    const historyLength = await page.evaluate(() => window.history.length);
    const url = page.url();
    trace.push(`${label}: url=${url} history.length=${historyLength}`);
    console.log(`[browser-qa] back-nav isolation — ${label}: url=${url} history.length=${historyLength}`);
  };
  const abortInvalid = async (reason: string, ...untestedSteps: string[]) => {
    for (const name of untestedSteps) skip(name, reason);
    record('Back-nav isolation — full history trace', 'FAIL', `INVALID — sequence aborted: ${reason}. Partial trace: ${trace.join(' | ') || '(none recorded)'}`);
    await reportPageIssues('Back-nav isolation (fresh context)', issues);
    await context.close();
  };

  issues.markNavigationAttempt();
  await page.goto(CUSTOMER_ORIGIN, { waitUntil: 'networkidle' });

  const loggedIn = await step('Back-nav isolation — direct STAGING_TEST_AUTH token issuance (bypasses the OTP resend-lock; see function doc)', async () => {
    const res = await page.request.post(`${API_ORIGIN}/api/v1/auth/otp/verify`, {
      data: { phone: '09121111111', code: '123456' },
      headers: { 'Content-Type': 'application/json' },
    });
    assert(res.ok(), `expected the STAGING_TEST_AUTH verify bypass to succeed, got HTTP ${res.status()}`);
    const json = (await res.json()) as { success?: boolean; data?: unknown };
    const data = (json.success === true ? json.data : json) as { status?: string; accessToken?: string; refreshToken?: string };
    assert(
      data.status === 'authenticated' && typeof data.accessToken === 'string' && typeof data.refreshToken === 'string',
      `expected an authenticated session with tokens, got status="${data.status}"`,
    );
    await page.evaluate(
      ({ accessToken, refreshToken }) => {
        localStorage.setItem('biawin.accessToken', accessToken);
        localStorage.setItem('biawin.refreshToken', refreshToken);
      },
      { accessToken: data.accessToken!, refreshToken: data.refreshToken! },
    );
    return true;
  });
  if (loggedIn !== true) {
    await abortInvalid('direct token issuance did not succeed', 'Back-nav isolation — click ONE category', 'Back-nav isolation — click ONE service', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  const atServices = await step('Back-nav isolation — navigate to /services (fresh context, zero prior Services history)', async () => {
    // A direct URL navigation, not a click through Home — AuthProvider's
    // mount effect picks up the token just seeded into localStorage and
    // AuthGuard renders Services immediately, no redirect.
    issues.markNavigationAttempt();
    await page.goto(`${CUSTOMER_ORIGIN}/services`, { waitUntil: 'networkidle' });
    assert(/\/services$/.test(page.url()), `expected to land on /services, got ${page.url()} — token seed likely did not take`);
    return true;
  });
  await recordStep('0. at /services');
  if (atServices !== true) {
    await abortInvalid('did not land on /services', 'Back-nav isolation — click ONE category', 'Back-nav isolation — click ONE CardProduct', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  // SERVICES-R1.6 finding: the previous version picked `category` as the
  // FIRST entry in the raw API response (snapshot.categories[0]) — which
  // happened to be "کودک و نوجوان", the LAST entry in
  // CATEGORY_GRID_ORDER (serviceCategoryVisual.ts) and therefore one of
  // the 8 categories ONLY revealed by "بیشتر" (CATEGORY_GRID_DEFAULT_COUNT
  // = 11), never visible in the default collapsed grid this test lands
  // on. Confirmed straight from source, not a screenshot guess — the same
  // fact is independently asserted by a passing, committed unit test
  // (CategoryGrid.test.tsx: "the 8 بیشتر-revealed categories must NOT be
  // in the initial render", explicitly checking کودک و نوجوان's absence).
  // Fixed by reading the category to click from what's ACTUALLY rendered
  // and visible right now (the real tile labels in the DOM), intersected
  // with the real snapshot — never assumed from API response order again.
  const category = await step('Back-nav isolation — select a category that is actually visible in the collapsed grid', async () => {
    const tiles = page.locator('main button').filter({ has: page.locator('img[alt=""]') });
    await tiles.first().waitFor({ timeout: 10000 });
    const count = await tiles.count();
    const visibleNames: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await tiles.nth(i).innerText()).trim();
      if (text) visibleNames.push(text);
    }
    assert(visibleNames.length > 0, 'expected at least one visible category tile');
    // Services Catalog Reset (Sep 2026) — clicking a category now routes
    // to its Category Landing page (`/categories/[slug]`, the canonical
    // discovery-card experience) only when it HAS a slug (see
    // apps/web/src/app/services/page.tsx's `handleSelectCategory`); every
    // one of the 14 real prototype-backed categories has one. Requiring
    // `slug` here keeps this test exercising the actual canonical route,
    // not the legacy `/services/{categoryId}` fallback for the (now
    // hidden, so not even visible in this grid) categories that never got
    // one.
    const match = visibleNames.map((name) => snapshot.categories.find((c) => c.name === name)).find((c) => c && !!c.slug && (byCategoryCount.get(c.id) ?? 0) > 0);
    assert(match !== undefined, `none of the ${visibleNames.length} visible tiles (${visibleNames.join(', ')}) matched a real, slugged category with at least one real CardProduct`);
    return match!;
  });
  await recordStep(`0b. selected visible category "${category?.name ?? '(none)'}"`);
  if (!category) {
    await abortInvalid('no visible, clickable category with real CardProducts could be selected', 'Back-nav isolation — click ONE CardProduct', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  const categoryUrlBefore = page.url();
  const categoryOk = await step(`Back-nav isolation — click ONE visible category ("${category.name}", slug=${category.slug})`, async () => {
    const tile = page.getByRole('button', { name: category.name, exact: true });
    await tile.waitFor({ timeout: 10000 });
    issues.markNavigationAttempt();
    await tile.click();
    // Services Catalog Reset (Sep 2026) — canonical destination is the
    // Category Landing page, not /services/{categoryId} (see
    // apps/web/src/app/services/page.tsx's `handleSelectCategory`).
    await page.waitForURL(new RegExp(`/categories/${category.slug}$`), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    assert(page.url() !== categoryUrlBefore, `expected the URL to change after clicking "${category.name}", stayed at ${categoryUrlBefore}`);
    return true;
  });
  await recordStep(`1. clicked category "${category.name}" (urlBefore=${categoryUrlBefore})`);
  if (categoryOk !== true) {
    await abortInvalid('category click did not succeed — see the category-click failure above; no forward navigation exists to test back from', 'Back-nav isolation — click ONE CardProduct', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  // The Category Landing's CardProduct tiles are transparent full-tile
  // `.cl-fc-hit` buttons whose accessible name (`aria-label`) is the card's
  // title — the header's back/share buttons also carry an aria-label, so the
  // tile is selected by its own class, never by "first button[aria-label]".
  // Read what is actually rendered; never assume array order.
  const cardUrlBefore = page.url();
  const cardLabel = await step('Back-nav isolation — read the first visible CardProduct tile\'s aria-label', async () => {
    const card = page.locator('.cl-fc-hit').first();
    await card.waitFor({ timeout: 10000 });
    const label = (await card.getAttribute('aria-label'))?.trim() ?? '';
    assert(label.length > 0, 'expected a non-empty CardProduct tile aria-label');
    return label;
  });
  if (!cardLabel) {
    await abortInvalid('no visible, clickable CardProduct tile was found on the Category Landing page', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  const cardOk = await step(`Back-nav isolation — click ONE visible CardProduct tile ("${cardLabel}") — straight to its detail`, async () => {
    const card = page.locator('.cl-fc-hit').first();
    issues.markNavigationAttempt();
    await card.click();
    await page.waitForURL(/\/services\/[^/]+\/[^/]+\/cards\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    assert(page.url() !== cardUrlBefore, `expected the URL to change after clicking "${cardLabel}", stayed at ${cardUrlBefore}`);
    return true;
  });
  await recordStep(`2. clicked CardProduct tile "${cardLabel}" (urlBefore=${cardUrlBefore})`);
  if (cardOk !== true) {
    await abortInvalid('CardProduct click did not succeed — see the click failure above; no forward navigation exists to test back from', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  await step('Back-nav isolation — goBack #1 returns to the SAME Category Landing page', async () => {
    issues.markNavigationAttempt();
    await page.goBack({ waitUntil: 'networkidle' });
    assert(new RegExp(`/categories/${category.slug}$`).test(page.url()), `expected /categories/${category.slug}, got ${page.url()}`);
  });
  await recordStep('3. after goBack #1');

  await step('Back-nav isolation — goBack #2 returns to exactly /services', async () => {
    issues.markNavigationAttempt();
    await page.goBack({ waitUntil: 'networkidle' });
    assert(/\/services$/.test(page.url()), `expected /services, got ${page.url()}`);
  });
  await recordStep('4. after goBack #2');

  record('Back-nav isolation — full history trace', 'PASS', trace.join(' | '));

  await reportPageIssues('Back-nav isolation (fresh context)', issues);
  await context.close();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function captureScreenshot(page: Page, name: string, viewport: { width: number; height: number }): Promise<void> {
  await step(`Screenshot: ${name} (${viewport.width}x${viewport.height})`, async () => {
    const path = `${SCREENSHOT_DIR}/${RUN_ID}-${name}.png`;
    await page.screenshot({ path, fullPage: true });
  });
}

async function reportPageIssues(context: string, issues: PageIssues): Promise<void> {
  const benignCount = issues.allFailedRequestEvents.filter((e) => e.classifiedBenign).length;
  if (issues.consoleErrors.length === 0 && issues.failedRequests.length === 0) {
    record(
      `Console/network — ${context}`,
      'PASS',
      `no console errors, no non-benign failed/5xx requests observed${benignCount > 0 ? ` (${benignCount} benign navigation-cancelled request(s) auto-classified — see Network diagnostics)` : ''}`,
    );
  } else {
    record(
      `Console/network — ${context}`,
      'FAIL',
      `${issues.consoleErrors.length} console error(s), ${issues.failedRequests.length} failed/5xx request(s): ` +
        [...issues.consoleErrors.slice(0, 5), ...issues.failedRequests.slice(0, 5)].join(' | '),
    );
  }

  // SERVICES-R1.4: every requestfailed event this page saw, benign or not,
  // recorded verbatim so a "classified benign" call is always auditable
  // from the report alone, never just asserted in code. This never
  // changes PASS/FAIL — that's decided above from issues.failedRequests
  // only, unaffected by this informational record.
  if (issues.allFailedRequestEvents.length > 0) {
    const lines = issues.allFailedRequestEvents.map(
      (e) =>
        `${e.classifiedBenign ? 'BENIGN' : 'REAL'}: ${e.method} ${e.url} — ${e.errorText} (resourceType=${e.resourceType}, pageUrlAtStart=${e.pageUrlAtStart}, pageUrlAtFailure=${e.pageUrlAtFailure}, qaStepAtStart="${e.qaStepAtStart}", qaStepAtFailure="${e.qaStepAtFailure}", elapsedMs=${e.elapsedMs}, navigationCorrelated=${e.navigationCorrelated}${e.benignReason ? `, reason: ${e.benignReason}` : ''})`,
    );
    record(`Network diagnostics — ${context}`, 'PASS', `${issues.allFailedRequestEvents.length} requestfailed event(s) observed:\n${lines.join('\n')}`);
  }
}

function writeReport(): void {
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const skipCount = results.filter((r) => r.status === 'NOT_TESTED').length;

  const lines: string[] = [];
  lines.push(`Stage 5.22 authenticated staging QA — browser/visual layer — ${new Date().toISOString()}`);
  lines.push(`Targets: customer=${CUSTOMER_ORIGIN} admin=${ADMIN_ORIGIN}`);
  lines.push('');
  for (const r of results) {
    const marker = r.status === 'PASS' ? 'PASS ' : r.status === 'FAIL' ? 'FAIL ' : 'SKIP ';
    lines.push(`${marker} ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  lines.push('');
  lines.push(`Totals: ${passCount} PASS, ${failCount} FAIL, ${skipCount} NOT_TESTED`);
  lines.push('');
  lines.push(
    'IMPORTANT: no pixel-diff against the Stage 5.14.1 approved visual baseline was performed — no baseline image ' +
      'exists as a repository artifact to compare against. The screenshots in the screenshots/ directory prove the ' +
      'pages render with real CMS content, no broken images, and no layout overflow at both breakpoints — they do ' +
      'NOT by themselves prove pixel-level fidelity to the approved design. A human comparing these screenshots ' +
      'against the Stage 5.14.1 baseline is still the final visual sign-off step.',
  );
  const humanReport = lines.join('\n');

  const humanPath = `${REPORT_DIR}/browser-qa-report-${RUN_ID}.txt`;
  const jsonPath = `${REPORT_DIR}/browser-qa-report-${RUN_ID}.json`;
  writeFileSync(humanPath, humanReport, 'utf8');
  writeFileSync(jsonPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2), 'utf8');

  console.log('');
  console.log(humanReport);
  console.log('');
  console.log(`[browser-qa] report written to: ${humanPath}`);
  console.log(`[browser-qa] screenshots written to: ${SCREENSHOT_DIR}/`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[browser-qa] unhandled error:', err);
  process.exit(1);
});
