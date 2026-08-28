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

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

interface PageIssues {
  consoleErrors: string[];
  failedRequests: string[];
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

function trackPageIssues(page: Page): PageIssues {
  const issues: PageIssues = { consoleErrors: [], failedRequests: [] };
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') issues.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req: Request) => {
    const errorText = req.failure()?.errorText ?? 'unknown';
    if (isBenignNextRscCancellation(req, errorText)) return;
    issues.failedRequests.push(`${req.method()} ${req.url()} — ${errorText}`);
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

  const loggedIn = await step('Customer STAGING_TEST_AUTH browser login (real UI flow)', async () => {
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
  });

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

  await runServicesModuleChecks(page);

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
 * ServiceSearchInput.tsx (`placeholder="جستجو در کارت‌های این خدمت..."`),
 * DisabledPurchaseCTA.tsx (`aria-label="خرید — به‌زودی"`, text "خرید این
 * خدمت" + "به‌زودی").
 */
async function runServicesModuleChecks(page: Page): Promise<void> {
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
    await page.getByRole('button', { name: categoryAsset.name, exact: true }).click();
    await page.waitForURL(new RegExp(`/services/${categoryAsset.id}$`), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  await step('Category View renders real hero (name/description), search input, and 5 real method-filter chips', async () => {
    const html = await page.content();
    assert(html.includes(categoryAsset.name), 'expected the real category name in the Category View hero');
    assert(html.includes(categoryAsset.description), 'expected the real category description in the Category View hero');
    await page.getByPlaceholder('جستجو در کارت‌های این خدمت...').waitFor({ timeout: 5000 });
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
      await page.getByPlaceholder('جستجو در کارت‌های این خدمت...').fill(searchTerm);
      await page.waitForTimeout(300);
      const html = await page.content();
      assert(html.includes(probe.title), `expected searching "${searchTerm}" to keep the real service "${probe.title}" visible`);
      await page.getByPlaceholder('جستجو در کارت‌های این خدمت...').fill('');
      await page.waitForTimeout(300);
    });
  }

  // Light visits — "many services" and "few services" categories (product decision: cover both extremes, not just the asset-mapped one).
  for (const [label, cat] of [['many-services', categoryMany], ['few-services', categoryFew]] as const) {
    if (cat.id === categoryAsset.id) continue;
    await step(`Category flow — "${cat.name}" (${label}, ${byCategory.get(cat.id)?.length ?? 0} real services)`, async () => {
      await page.goto(`${CUSTOMER_ORIGIN}/services/${cat.id}`, { waitUntil: 'networkidle' });
      const html = await page.content();
      assert(html.includes(cat.name), `expected real category name "${cat.name}" in the hero`);
      const { broken } = await assertNoBrokenImages(page);
      assert(broken.length === 0, `broken images on "${cat.name}" Category View`);
      const cardCount = await mainStrongTitles.count();
      assert(cardCount === (byCategory.get(cat.id)?.length ?? 0), `expected ${byCategory.get(cat.id)?.length ?? 0} cards for "${cat.name}", got ${cardCount}`);
    });
  }

  // Back to the asset category for the cardOnly Service Detail flow.
  await page.goto(`${CUSTOMER_ORIGIN}/services/${categoryAsset.id}`, { waitUntil: 'networkidle' });

  const firstCard = page.locator('main button').filter({ has: page.locator('strong') }).first();
  let serviceDetailUrl: string | null = null;
  if ((await firstCard.count()) > 0) {
    await step('Service Detail — Services-origin click navigation renders cardOnly (no full payment-method chooser)', async () => {
      await firstCard.click();
      await page.waitForURL(/\/services\/[^/]+\/[^/]+$/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      serviceDetailUrl = page.url();
      const html = await page.content();
      assert(!html.includes('خرید اعتباری') && !html.includes('خرید قسطی') && !html.includes('رایگان و جایزه'), 'full-mode payment-plan copy must not render from Services-origin navigation');
      assert(html.includes('خرید این خدمت'), 'expected the real disabled purchase CTA text');
      assert(html.includes('به‌زودی'), 'expected the "به‌زودی" caption on the disabled CTA');
      const ctaDisabled = await page.getByRole('button', { name: 'خرید — به‌زودی' }).isDisabled();
      assert(ctaDisabled, 'expected the purchase CTA button to be disabled');
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
      await page.goBack({ waitUntil: 'networkidle' });
      assert(new RegExp(`/services/${categoryAsset.id}$`).test(page.url()), `expected to return to /services/${categoryAsset.id}, got ${page.url()}`);
    });

    await step('Browser back from Category View returns to Services List', async () => {
      await page.goBack({ waitUntil: 'networkidle' });
      assert(/\/services$/.test(page.url()), `expected to return to /services, got ${page.url()}`);
    });
  } else {
    skip('Service Detail (Services-origin click flow)', `"${categoryAsset.name}" has no real services to click through`);
  }

  const fewProbe = (byCategory.get(categoryFew.id) ?? [])[0];
  if (fewProbe) {
    await step('Service Detail — cold direct URL navigation (bookmark/share, no click/history) is stable and still cardOnly', async () => {
      await page.goto(`${CUSTOMER_ORIGIN}/services/${categoryFew.id}/${fewProbe.id}`, { waitUntil: 'networkidle' });
      const html = await page.content();
      assert(!html.includes('خرید اعتباری') && !html.includes('خرید قسطی') && !html.includes('رایگان و جایزه'), 'direct URL navigation must also render cardOnly, not the full chooser');
      assert(html.includes('خرید این خدمت'), 'expected the disabled purchase CTA on direct URL navigation too');
    });
  } else if (serviceDetailUrl) {
    await step('Service Detail — cold direct URL re-navigation (new context) is stable and still cardOnly', async () => {
      await page.goto(serviceDetailUrl!, { waitUntil: 'networkidle' });
      const html = await page.content();
      assert(html.includes('خرید این خدمت'), 'expected the disabled purchase CTA on direct URL re-navigation');
    });
  } else {
    skip('Service Detail (direct URL navigation)', 'no real service was reachable to test a direct URL against');
  }

  await step('Home smoke after Services navigation — CMS content still renders, no state corruption', async () => {
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
// Shared helpers
// ---------------------------------------------------------------------------

async function captureScreenshot(page: Page, name: string, viewport: { width: number; height: number }): Promise<void> {
  await step(`Screenshot: ${name} (${viewport.width}x${viewport.height})`, async () => {
    const path = `${SCREENSHOT_DIR}/${RUN_ID}-${name}.png`;
    await page.screenshot({ path, fullPage: true });
  });
}

async function reportPageIssues(context: string, issues: PageIssues): Promise<void> {
  if (issues.consoleErrors.length === 0 && issues.failedRequests.length === 0) {
    record(`Console/network — ${context}`, 'PASS', 'no console errors, no failed/5xx requests observed');
    return;
  }
  record(
    `Console/network — ${context}`,
    'FAIL',
    `${issues.consoleErrors.length} console error(s), ${issues.failedRequests.length} failed/5xx request(s): ` +
      [...issues.consoleErrors.slice(0, 5), ...issues.failedRequests.slice(0, 5)].join(' | '),
  );
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
