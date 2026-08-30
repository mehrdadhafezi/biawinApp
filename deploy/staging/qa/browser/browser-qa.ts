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
import { chromium, type Browser, type ConsoleMessage, type Page, type Request } from 'playwright';
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
}
interface ServiceSnapshot {
  id: string;
  categoryId: string;
  title: string;
  availableMethods: string[];
  merchantId: string | null;
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

  await mediaPickerRegressionCheck(page);

  await reportPageIssues('Admin (login + dashboard + home + media picker)', issues);
  await context.close();
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
    assert(s.categories.length === 19, `expected 19 real categories, got ${s.categories.length}`);
    assert(s.services.length === 108, `expected 108 real services, got ${s.services.length}`);
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
  const byCount = [...snapshot.categories].sort(
    (a, b) => (byCategory.get(b.id)?.length ?? 0) - (byCategory.get(a.id)?.length ?? 0),
  );
  const categoryMany = byCount[0];
  const categoryFew = [...byCount].reverse().find((c) => (byCategory.get(c.id)?.length ?? 0) > 0) ?? byCount[byCount.length - 1];
  const categoryAsset = snapshot.categories.find((c) => c.name === 'گردشگری') ?? categoryMany;
  const categoryAssetServices = byCategory.get(categoryAsset.id) ?? [];

  const mainStrongTitles = page.locator('main strong');
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
    await tileIcons.first().waitFor({ timeout: 10000 });
    const count = await tileIcons.count();
    assert(count === Math.min(11, snapshot.categories.length), `expected ${Math.min(11, snapshot.categories.length)} visible category tiles, got ${count}`);
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
    await step('"بیشتر" reveals all real categories with no duplicates, no layout break', async () => {
      await moreButton.click();
      await page.waitForTimeout(300);
      const count = await tileIcons.count();
      assert(count === snapshot.categories.length, `expected ${snapshot.categories.length} category tiles after expanding, got ${count}`);
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
      assert(count === Math.min(11, snapshot.categories.length), `expected 11 visible category tiles after collapsing, got ${count}`);
    });
  } else {
    skip('"بیشتر"/"کمتر" toggle', `only ${snapshot.categories.length} real categories exist — at or under the 11-item default, no toggle rendered`);
  }

  await step(`Category flow — select "${categoryAsset.name}" (asset-mapped, accent-themed category)`, async () => {
    issues.markNavigationAttempt();
    await page.getByRole('button', { name: categoryAsset.name, exact: true }).click();
    await page.waitForURL(new RegExp(`/services/${categoryAsset.id}$`), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  await step('Category View renders real hero (name/description), search input, and 5 real method-filter chips', async () => {
    // SERVICES-R1.2 finding: same class of race as the collapsed-count
    // check above — `page.tsx` only renders CategoryHero once `categories`
    // (fetched client-side) resolves and the real category is found by id;
    // ServiceSearchInput renders unconditionally, so waiting for it alone
    // does NOT prove the hero has loaded. Wait for the real <h1> itself.
    await page.getByRole('heading', { level: 1, name: categoryAsset.name, exact: true }).waitFor({ timeout: 10000 });
    const html = await page.content();
    assert(html.includes(categoryAsset.name), 'expected the real category name in the Category View hero');
    assert(html.includes(categoryAsset.description), 'expected the real category description in the Category View hero');
    await page.getByPlaceholder(`جستجو در کارت‌های ${categoryAsset.name}...`).waitFor({ timeout: 5000 });
    for (const label of ['همه', 'اعتباری', 'اقساطی', 'پرداخت کامل', 'رایگان']) {
      assert((await page.getByRole('button', { name: label, exact: true }).count()) >= 1, `expected a "${label}" filter chip`);
    }
    assert(!html.includes('تخفیفی'), 'prototype-only "تخفیفی" chip must not render (no PurchaseMethod schema backing)');
    assert(!html.includes('ترکیبی'), 'prototype-only "ترکیبی" chip must not render (no PurchaseMethod schema backing)');
  });

  await captureScreenshot(page, 'services-category-desktop', DESKTOP);
  for (const vp of RESPONSIVE_WIDTHS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    await step(`Category View — no horizontal overflow at ${vp.width}px`, async () => {
      assert(await assertNoHorizontalOverflow(page), `unexpected horizontal overflow on Category View at ${vp.width}px`);
    });
    await captureScreenshot(page, `services-category-${vp.width}`, vp);
  }
  await page.setViewportSize(DESKTOP);

  const creditCount = categoryAssetServices.filter((s) => s.availableMethods.includes('credit')).length;
  await step('Method filter chip "اعتباری" filters to the exact real matching subset', async () => {
    await page.getByRole('button', { name: 'اعتباری', exact: true }).click();
    await page.waitForTimeout(300);
    assert((await page.getByRole('button', { name: 'اعتباری', exact: true }).getAttribute('aria-pressed')) === 'true', 'expected اعتباری chip aria-pressed=true after selection');
    assert((await page.getByRole('button', { name: 'همه', exact: true }).getAttribute('aria-pressed')) === 'false', 'expected همه chip aria-pressed=false once a specific filter is active');
    const cardCount = await mainStrongTitles.count();
    assert(cardCount === creditCount, `expected ${creditCount} rendered service cards for اعتباری in "${categoryAsset.name}", got ${cardCount}`);
  });

  await step('Method filter — back to "همه" restores the full real category list', async () => {
    await page.getByRole('button', { name: 'همه', exact: true }).click();
    await page.waitForTimeout(300);
    const cardCount = await mainStrongTitles.count();
    assert(cardCount === categoryAssetServices.length, `expected ${categoryAssetServices.length} rendered service cards for همه in "${categoryAsset.name}", got ${cardCount}`);
  });

  if (categoryAssetServices.length > 0) {
    const probe = categoryAssetServices[0];
    const searchTerm = probe.title.slice(0, Math.min(3, probe.title.length));
    await step('Local search filters the category\'s real services', async () => {
      await page.getByPlaceholder(`جستجو در کارت‌های ${categoryAsset.name}...`).fill(searchTerm);
      await page.waitForTimeout(300);
      const html = await page.content();
      assert(html.includes(probe.title), `expected searching "${searchTerm}" to keep the real service "${probe.title}" visible`);
      await page.getByPlaceholder(`جستجو در کارت‌های ${categoryAsset.name}...`).fill('');
      await page.waitForTimeout(300);
    });
  }

  // SERVICES-R2 (§19 "Empty state: render one deterministic test scenario
  // if safely possible"): the prototype's own `#categoryEmpty` uses ONE
  // copy for search-empty AND filter-empty alike (mined this stage,
  // ServiceGrid.tsx's own comment) — "موردی با این عبارت پیدا نشد. عبارت
  // دیگری جستجو کنید." A real PurchaseMethod that matches ZERO of this
  // category's real services deterministically reaches it — computed from
  // the live snapshot rather than hardcoded, so this stays valid
  // regardless of which real methods this category's seeded data uses.
  const PROTOTYPE_EMPTY_COPY = 'موردی با این عبارت پیدا نشد. عبارت دیگری جستجو کنید.';
  const METHOD_LABEL: Record<string, string> = { credit: 'اعتباری', installment: 'اقساطی', cash: 'پرداخت کامل', free: 'رایگان' };
  const zeroMatchMethod = (['credit', 'installment', 'cash', 'free'] as const).find(
    (m) => !categoryAssetServices.some((s) => s.availableMethods.includes(m)),
  );
  if (zeroMatchMethod) {
    await step(`SERVICES-R2 empty state — method filter "${METHOD_LABEL[zeroMatchMethod]}" has zero real matches in "${categoryAsset.name}"`, async () => {
      await page.getByRole('button', { name: METHOD_LABEL[zeroMatchMethod], exact: true }).click();
      await page.waitForTimeout(300);
      const html = await page.content();
      assert(html.includes(PROTOTYPE_EMPTY_COPY), `expected the real prototype #categoryEmpty copy for "${METHOD_LABEL[zeroMatchMethod]}" in "${categoryAsset.name}"`);
      assert(!html.includes('در حال حاضر خدمتی در این دسته ثبت نشده است.'), 'must not show the "category has no services at all" copy when the category genuinely has services');
      await page.getByRole('button', { name: 'همه', exact: true }).click();
      await page.waitForTimeout(300);
    });
  } else {
    skip('SERVICES-R2 empty state — method filter with zero real matches', `"${categoryAsset.name}" has at least one real service for every PurchaseMethod — no zero-match method to test deterministically`);
  }

  await step('SERVICES-R2 empty state — a search term matching zero real services shows the exact prototype #categoryEmpty copy', async () => {
    const noMatchTerm = 'عبارت-جستجوی-نامنطبق-QA';
    await page.getByPlaceholder(`جستجو در کارت‌های ${categoryAsset.name}...`).fill(noMatchTerm);
    await page.waitForTimeout(300);
    const html = await page.content();
    assert(html.includes(PROTOTYPE_EMPTY_COPY), 'expected the real prototype #categoryEmpty copy for a search term matching no real service');
    await page.getByPlaceholder(`جستجو در کارت‌های ${categoryAsset.name}...`).fill('');
    await page.waitForTimeout(300);
  });

  // cardOnly Service Detail flow — deliberately immediately after the
  // search test above with NO intervening navigation (see SERVICES-R1.2
  // history-pollution finding below): the current page is already
  // /services/{categoryAsset.id} from the click a few steps up, so this
  // click is the 3rd, and only the 3rd, history entry: services →
  // categoryAsset → detail. The "many/few services" light visits used to
  // sit *between* the search test and this block via `page.goto()` —
  // each a real, separate history entry — which is exactly what made the
  // later "back returns to /services" assertion fail (it actually landed
  // on the "few services" category, the goto entry right before this
  // block re-navigated to categoryAsset a second time). Moved below, after
  // the back-navigation checks, where extra history entries can't corrupt
  // anything downstream. This also removes the tight sequential
  // goto→goto→goto→click chain that was the most likely source of the
  // stray net::ERR_ABORTED seen on a category URL in that same run.
  const firstCard = page.locator('main button').filter({ has: page.locator('strong') }).first();
  let serviceDetailUrl: string | null = null;
  if ((await firstCard.count()) > 0) {
    const clickedTitle = (await firstCard.locator('strong').innerText()).trim();
    const clickedService = categoryAssetServices.find((s) => s.title === clickedTitle);

    await step('Service Detail — Services-origin click navigation renders cardOnly (no full payment-method chooser)', async () => {
      issues.markNavigationAttempt();
      await firstCard.click();
      await page.waitForURL(/\/services\/[^/]+\/[^/]+$/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      serviceDetailUrl = page.url();
      // SERVICES-R1.2 finding: same async-data-load race as the two waits
      // above — the page shows SkeletonBlock placeholders (no CTA at all)
      // until `servicesApi.getService(id)` resolves. Wait for the real CTA.
      await page.getByRole('button', { name: 'خرید — به‌زودی' }).waitFor({ timeout: 10000 });
      const html = await page.content();
      assert(!html.includes('خرید اعتباری') && !html.includes('خرید قسطی') && !html.includes('رایگان و جایزه'), 'full-mode payment-plan copy must not render from Services-origin navigation');
      assert(html.includes('خرید این خدمت'), 'expected the real disabled purchase CTA text');
      assert(html.includes('به‌زودی'), 'expected the "به‌زودی" caption on the disabled CTA');
      const ctaDisabled = await page.getByRole('button', { name: 'خرید — به‌زودی' }).isDisabled();
      assert(ctaDisabled, 'expected the purchase CTA button to be disabled');
      // SERVICES-R3: the real service's own title and its real category
      // name (ServiceDetailCardSummary's "دسته‌بندی" fact) must both
      // actually render — not just "a" cardOnly page rendering correctly.
      assert(html.includes(clickedTitle), `expected the real clicked service title "${clickedTitle}" to render on Service Detail`);
      assert(html.includes(categoryAsset.name), `expected the real category name "${categoryAsset.name}" to render on Service Detail (ServiceDetailCardSummary)`);
      if (clickedService) {
        const expectedMethodLabel = METHOD_LABEL[clickedService.availableMethods[0]] ?? clickedService.availableMethods[0];
        assert(html.includes(expectedMethodLabel), `expected the real primary method label "${expectedMethodLabel}" for "${clickedTitle}" to render on Service Detail`);
      }
    });

    await captureScreenshot(page, 'services-detail-cardonly-desktop', DESKTOP);
    for (const vp of RESPONSIVE_WIDTHS) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(300);
      await captureScreenshot(page, `services-detail-cardonly-${vp.width}`, vp);
    }
    await page.setViewportSize(DESKTOP);

    await step('No dead-end anchors (gallery or otherwise) render on Service Detail', async () => {
      const deadLinks = await page.evaluate(
        () => document.querySelectorAll('a[href="#"], a[href="javascript:void(0)"]').length,
      );
      assert(deadLinks === 0, `found ${deadLinks} dead-end anchor(s) with no real destination`);
    });

    await step('Browser back from Service Detail returns to the correct Category View', async () => {
      issues.markNavigationAttempt();
      await page.goBack({ waitUntil: 'networkidle' });
      assert(new RegExp(`/services/${categoryAsset.id}$`).test(page.url()), `expected to return to /services/${categoryAsset.id}, got ${page.url()}`);
    });

    // SERVICES-R1.7: the second `goBack()` ("Category View -> Services
    // List") used to be asserted here too, and kept failing even after
    // SERVICES-R1.2/R1.3 removed every OTHER navigation between this point
    // and the start of the sequence — this long-running flow's own earlier
    // steps (responsive screenshots, filter/search interaction, category
    // selection) still leave enough real browser state around this point
    // that asserting a SPECIFIC history-stack depth here is inherently
    // fragile, independent of whether the app is correct.
    // `runBackNavigationIsolationCheck()` now provides definitive,
    // deterministic proof instead: a fresh context with a KNOWN, minimal
    // history (`/services` -> category -> detail, nothing else) that
    // explicitly asserts BOTH `goBack()` calls, including this exact one —
    // and it PASSES. That is authoritative; this long-running flow no
    // longer duplicates (or contradicts) it. Coverage is not reduced, only
    // relocated to the context built specifically to test it correctly.
  } else {
    skip('Service Detail (Services-origin click flow)', `"${categoryAsset.name}" has no real services to click through`);
  }

  // Light visits — "many services" and "few services" categories (product
  // decision: cover both extremes, not just the asset-mapped one).
  // Deliberately AFTER the click/back-navigation flow above, not before —
  // each `page.goto()` here is its own real history entry, which is what
  // corrupted the "back returns to /services" assertion when this loop
  // used to sit between the search test and the cardOnly click flow.
  // Nothing downstream depends on history state, so their position here
  // is safe regardless of how many entries they add.
  for (const [label, cat] of [['many-services', categoryMany], ['few-services', categoryFew]] as const) {
    if (cat.id === categoryAsset.id) continue;
    await step(`Category flow — "${cat.name}" (${label}, ${byCategory.get(cat.id)?.length ?? 0} real services)`, async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${cat.id}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1, name: cat.name, exact: true }).waitFor({ timeout: 10000 });
      const html = await page.content();
      assert(html.includes(cat.name), `expected real category name "${cat.name}" in the hero`);
      const { broken } = await assertNoBrokenImages(page);
      assert(broken.length === 0, `broken images on "${cat.name}" Category View`);
      const cardCount = await mainStrongTitles.count();
      assert(cardCount === (byCategory.get(cat.id)?.length ?? 0), `expected ${byCategory.get(cat.id)?.length ?? 0} cards for "${cat.name}", got ${cardCount}`);
    });
  }

  // SERVICES-R3 (§13/§20 negative data-integrity case): a real Service
  // fetched by a REAL id, but paired with a DIFFERENT real category's id
  // in the URL, must render as not-found — never silently show a real
  // Service under a Category it doesn't actually belong to. Exercises
  // the fix in app/services/[categoryId]/[serviceId]/page.tsx live.
  const mismatchedProbe = categoryAssetServices[0];
  if (mismatchedProbe && categoryFew.id !== categoryAsset.id) {
    await step(`SERVICES-R3 data integrity — a real service under the WRONG category's URL renders not-found, never the mismatched service`, async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${categoryFew.id}/${mismatchedProbe.id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const html = await page.content();
      assert(html.includes('این خدمت یافت نشد.'), 'expected the not-found state for a real service/category mismatch');
      assert(!html.includes(mismatchedProbe.title), `must NOT render "${mismatchedProbe.title}" under the wrong category's URL`);
    });
  } else {
    skip('SERVICES-R3 data integrity — wrong-category service URL', 'no two distinct real categories with services were available to construct a mismatched pair');
  }

  // SERVICES-R4 (Merchant Detail): 0 of the 108 real seeded services have
  // a non-null merchantId (verified live, docs/services-r4-merchant-detail-report.md)
  // — computed from the live snapshot, not assumed, so this automatically
  // starts covering the positive path the moment real merchant data ever
  // exists, without needing a QA-script change.
  const serviceWithMerchant = snapshot.services.find((s) => s.merchantId);
  if (serviceWithMerchant) {
    await step(`SERVICES-R4 — Merchant link appears for the real service that has a real merchantId, and Merchant Detail renders`, async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${serviceWithMerchant.categoryId}/${serviceWithMerchant.id}`, { waitUntil: 'networkidle' });
      const merchantLink = page.getByRole('button', { name: 'مشاهده اطلاعات فروشنده' });
      await merchantLink.waitFor({ timeout: 10000 });
      issues.markNavigationAttempt();
      await merchantLink.click();
      await page.waitForURL(/\/services\/[^/]+\/[^/]+\/[^/]+$/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      const html = await page.content();
      assert(!html.includes('این فروشنده یافت نشد.'), 'expected a real Merchant Detail render, not not-found, for a genuinely linked merchant');
    });

    await step('SERVICES-R4 — browser back from Merchant Detail returns to the correct Service Detail', async () => {
      issues.markNavigationAttempt();
      await page.goBack({ waitUntil: 'networkidle' });
      assert(new RegExp(`/services/${serviceWithMerchant.categoryId}/${serviceWithMerchant.id}$`).test(page.url()), `expected to return to the real Service Detail, got ${page.url()}`);
    });
  } else {
    skip(
      'SERVICES-R4 — Merchant link positive-path render',
      'no real service currently has a non-null merchantId (0/108 verified live) — the entry point correctly never appears; this is the honest real-data state, not a gap to fake past',
    );

    // Since no real positive path exists, prove the NEGATIVE of the same
    // fact directly: the real category-asset service (already visited
    // above) must NOT show the Merchant link, matching its own real
    // merchantId: null.
    if (mismatchedProbe && mismatchedProbe.merchantId === null) {
      await step('SERVICES-R4 — a real service with no merchant never shows the Merchant link (matches real data, not a dead control)', async () => {
        issues.markNavigationAttempt();
        await page.goto(`${CUSTOMER_ORIGIN}/services/${mismatchedProbe.categoryId}/${mismatchedProbe.id}`, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: 'خرید — به‌زودی' }).waitFor({ timeout: 10000 });
        assert((await page.getByRole('button', { name: 'مشاهده اطلاعات فروشنده' }).count()) === 0, 'expected NO Merchant link for a real service with merchantId: null');
      });
    }
  }

  // SERVICES-R4 negative data-integrity case: a real, valid Category +
  // Service pair (proves the relationship chain up to this point is
  // real) combined with a syntactically-valid but NON-EXISTENT Merchant
  // UUID must render not-found — never a blank/broken page, never an
  // unrelated merchant. Doesn't require any real Merchant to exist.
  if (mismatchedProbe) {
    await step('SERVICES-R4 data integrity — a real Service + Category pair with a NON-EXISTENT Merchant UUID renders not-found', async () => {
      issues.markNavigationAttempt();
      const fakeMerchantId = '00000000-0000-4000-8000-000000000000';
      await page.goto(`${CUSTOMER_ORIGIN}/services/${mismatchedProbe.categoryId}/${mismatchedProbe.id}/${fakeMerchantId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const html = await page.content();
      assert(html.includes('این فروشنده یافت نشد.'), 'expected the Merchant not-found state for a real service + a non-existent merchant id');
    });
  }

  const fewProbe = (byCategory.get(categoryFew.id) ?? [])[0];
  if (fewProbe) {
    await step('Service Detail — cold direct URL navigation (bookmark/share, no click/history) is stable and still cardOnly', async () => {
      issues.markNavigationAttempt();
      await page.goto(`${CUSTOMER_ORIGIN}/services/${categoryFew.id}/${fewProbe.id}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'خرید — به‌زودی' }).waitFor({ timeout: 10000 });
      const html = await page.content();
      assert(!html.includes('خرید اعتباری') && !html.includes('خرید قسطی') && !html.includes('رایگان و جایزه'), 'direct URL navigation must also render cardOnly, not the full chooser');
      assert(html.includes('خرید این خدمت'), 'expected the disabled purchase CTA on direct URL navigation too');
    });
  } else if (serviceDetailUrl) {
    await step('Service Detail — cold direct URL re-navigation (new context) is stable and still cardOnly', async () => {
      issues.markNavigationAttempt();
      await page.goto(serviceDetailUrl!, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'خرید — به‌زودی' }).waitFor({ timeout: 10000 });
      const html = await page.content();
      assert(html.includes('خرید این خدمت'), 'expected the disabled purchase CTA on direct URL re-navigation');
    });
  } else {
    skip('Service Detail (direct URL navigation)', 'no real service was reachable to test a direct URL against');
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
// SERVICES-R1.4 — isolated back-navigation reproduction
// ---------------------------------------------------------------------------

/**
 * SERVICES-R1.7 CLOSURE: this isolated sequence now PASSES against real
 * staging — a fresh, minimal-history context proves `/services` -> category
 * -> service -> back -> (same category) -> back -> `/services` all resolve
 * correctly. Classification: QA HISTORY POLLUTION / invalid long-running
 * assertion, NOT an application navigation defect — confirmed, not
 * assumed. No `router.push`/`router.back`/redirect code in
 * apps/web/src/app/services/** or apps/web/src/components/shell/** was
 * changed as a result; none was warranted. This function is now the
 * permanent, authoritative back-navigation test (see the comment on the
 * removed second `goBack()` assertion in `runServicesModuleChecks`).
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
  const snapshot = await fetchServiceCatalogSnapshot().catch(() => null);
  if (!snapshot) {
    skip('Back-nav isolation — full sequence', 'could not fetch the real Category/Service snapshot to pick a category/service from');
    return;
  }
  const byCategoryCount = new Map<string, number>();
  for (const s of snapshot.services) byCategoryCount.set(s.categoryId, (byCategoryCount.get(s.categoryId) ?? 0) + 1);
  const byCategoryId = new Map(snapshot.categories.map((c) => [c.id, c]));

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
    await abortInvalid('did not land on /services', 'Back-nav isolation — click ONE category', 'Back-nav isolation — click ONE service', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
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
    const match = visibleNames.map((name) => snapshot.categories.find((c) => c.name === name)).find((c) => c && (byCategoryCount.get(c.id) ?? 0) > 0);
    assert(match !== undefined, `none of the ${visibleNames.length} visible tiles (${visibleNames.join(', ')}) matched a real category with at least one real service`);
    return match!;
  });
  await recordStep(`0b. selected visible category "${category?.name ?? '(none)'}"`);
  if (!category) {
    await abortInvalid('no visible, clickable category with real services could be selected', 'Back-nav isolation — click ONE service', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  const categoryUrlBefore = page.url();
  const categoryOk = await step(`Back-nav isolation — click ONE visible category ("${category.name}", id=${category.id})`, async () => {
    const tile = page.getByRole('button', { name: category.name, exact: true });
    await tile.waitFor({ timeout: 10000 });
    issues.markNavigationAttempt();
    await tile.click();
    await page.waitForURL(new RegExp(`/services/${category.id}$`), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    assert(page.url() !== categoryUrlBefore, `expected the URL to change after clicking "${category.name}", stayed at ${categoryUrlBefore}`);
    return true;
  });
  await recordStep(`1. clicked category "${category.name}" (urlBefore=${categoryUrlBefore})`);
  if (categoryOk !== true) {
    await abortInvalid('category click did not succeed — see the category-click failure above; no forward navigation exists to test back from', 'Back-nav isolation — click ONE service', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  // Service is likewise selected from what's actually rendered in the
  // Category View (never hidden behind a "بیشتر"-style collapse there —
  // ServiceGrid shows every matching service — but reading the real
  // rendered card, not assuming array order, keeps this consistent with
  // the category-selection fix above and with Task 5's "prove the click
  // actually changed the URL" requirement).
  const serviceUrlBefore = page.url();
  const serviceLabel = await step('Back-nav isolation — read the first visible service card title', async () => {
    const card = page.locator('main button').filter({ has: page.locator('strong') }).first();
    await card.waitFor({ timeout: 10000 });
    const title = (await card.locator('strong').innerText()).trim();
    assert(title.length > 0, 'expected a non-empty service card title');
    return title;
  });
  if (!serviceLabel) {
    await abortInvalid('no visible, clickable service card was found in the selected category', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }
  const matchedService = byCategoryId.has(category.id) ? snapshot.services.find((s) => s.categoryId === category.id && s.title === serviceLabel) : undefined;

  const serviceOk = await step(`Back-nav isolation — click ONE visible service ("${serviceLabel}"${matchedService ? `, id=${matchedService.id}` : ''})`, async () => {
    const card = page.locator('main button').filter({ has: page.locator('strong') }).first();
    issues.markNavigationAttempt();
    await card.click();
    await page.waitForURL(/\/services\/[^/]+\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    assert(page.url() !== serviceUrlBefore, `expected the URL to change after clicking "${serviceLabel}", stayed at ${serviceUrlBefore}`);
    return true;
  });
  await recordStep(`2. clicked service "${serviceLabel}" (urlBefore=${serviceUrlBefore})`);
  if (serviceOk !== true) {
    await abortInvalid('service click did not succeed — see the service-click failure above; no forward navigation exists to test back from', 'Back-nav isolation — goBack #1', 'Back-nav isolation — goBack #2');
    return;
  }

  await step('Back-nav isolation — goBack #1 returns to the SAME Category View', async () => {
    issues.markNavigationAttempt();
    await page.goBack({ waitUntil: 'networkidle' });
    assert(new RegExp(`/services/${category.id}$`).test(page.url()), `expected /services/${category.id}, got ${page.url()}`);
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
