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
const DESKTOP = { width: 1440, height: 900 };

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

function trackPageIssues(page: Page): PageIssues {
  const issues: PageIssues = { consoleErrors: [], failedRequests: [] };
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') issues.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req: Request) => {
    issues.failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
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

  await reportPageIssues('Customer (landing + login + Home)', issues);
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
