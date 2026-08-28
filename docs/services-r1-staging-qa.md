# SERVICES-R1 — Staging Deployment + Authenticated Live QA

Real deployment and QA history against `https://staging.biawin.ir`, kept
honest and append-only — failed runs are recorded as they happened, not
overwritten once fixed.

---

## Deployment #1

| | |
|---|---|
| Previous staging revision | `db35c273f7fe398993f3dfbbc92b8839f925fb60` |
| Target/deployed revision | `bc2fe24242c04b78fac6089d551c67bdbd7db28e` |
| Mechanism | `deploy/staging/deploy.sh` (Stage 5.22, unmodified) |
| Migrations | **NONE** — `backend/prisma/migrations` and `schema.prisma` are byte-identical between `db35c27` and `bc2fe24` (verified via `git diff --stat`); `prisma migrate deploy` itself reported "7 migrations found, no pending migrations to apply" |
| Result | **PASS** — "deploy successful: backend healthy on 127.0.0.1:4001, web responding on 127.0.0.1:3001, admin responding on 127.0.0.1:3002" |
| Data safety | No `down`/`down -v`, no volume recreation, no Prisma reset — confirmed by reading `deploy.sh` before running it; deploy log's own "All previously-linked Home assets were correctly skipped as already linked" confirms Media Library untouched |

**Post-deploy verification (this session, independent of the deploy log):**

| Check | Result |
|---|---|
| Public `https://staging.biawin.ir/` | PASS — HTTP 200, TLS OK |
| Public `https://api-staging.biawin.ir/api/health` | PASS — HTTP 200, TLS OK |
| Public `https://admin-staging.biawin.ir/` | PASS — HTTP 307 → login (expected, unauthenticated) |
| `GET /api/v1/categories` | PASS — `total:19`, 19 real UUIDs, real Persian names (کودک و نوجوان, مالی و اعتباری, …) |
| `GET /api/v1/services` (2 pages) | PASS — `total:108`, 100+8 real UUIDs, real Persian titles (لوازم نوزاد, کلاس‌های مهارتی, …) |
| Synthetic/prototype marker scan (`buildServiceOffers`, `categoryCatalog`, literal prototype card labels) in the live API responses | PASS — zero matches |
| `GET /api/v1/home/hero-cards` | PASS — 3 records present (Home CMS content intact) |

---

## QA Run #1 (against `bc2fe24`) — FAILED, root-caused below

**API layer: 0 PASS / 1 FAIL / 0 NOT_TESTED** (fatal — stopped after the first check)
**Browser layer: 51 PASS / 5 FAIL / 0 NOT_TESTED**

This is the real, unedited result of the first authenticated QA run. It is
recorded here exactly as it happened, before any fix.

### Classification table

| # | Failure | Root cause | Classification | App fix? | QA fix? | Evidence |
|---|---|---|---|---|---|---|
| 1 | API: `Admin login (SUPER_ADMIN) — fetch failed` | The API-layer runner executes **inside the `backend` container** via `docker compose run`, which is a compose-network member, not a general-internet host. That container could not reach the public domain `https://api-staging.biawin.ir` it defaulted to. The *browser*-layer container (a separate, plain `docker run`, closer to a real client) reached the same public domain and the same credentials fine seconds later — ruling out bad credentials. Node's `fetch` only threw `TypeError: fetch failed` with the real cause buried on `err.cause`, which the runner's `step()` never surfaced. | **D — infra/QA-runner connectivity** (self-networking limitation of the compose-run container; anticipated but unconfirmed in a Stage 5.22 code comment, now confirmed) | No | Yes | `run-authenticated-qa.sh`'s own comment already flagged this as an untested possibility; browser-layer login succeeding with the same secrets in the same run is direct proof credentials/backend auth logic are fine |
| 2 | Browser: `Services List shows exactly the first 11 real categories by default` — expected 11, got 0 | `CategoryGrid` shows 12 `SkeletonBlock`s (no `<img>`) until `useServiceCatalog()`'s client-side categories fetch resolves. The QA script counted tiles immediately after `networkidle`, before that fetch's state update landed — a race, not a rendering bug. Proven by the SAME run's later `"بیشتر" reveals all real categories` and `"کمتر" collapses back` both PASSing once state had caught up. | **B — QA assertion defect (missing wait)** | No | Yes | Later steps in the identical run passed with correct real counts |
| 3 | Browser: `Category View renders real hero...` — category name not found in `page.content()` | Same race as #2: `CategoryHero` only renders once `categories` (client-fetched) resolves and `category.id === params.categoryId` matches; the script snapshotted `page.content()` immediately after navigation, before that resolved. Proven by the SAME run's later `Method filter اعتباری` step passing — which requires the exact real filtered service-card count to match the live API snapshot, meaning the category view HAD fully loaded moments later. | **B — QA assertion defect (missing wait)** | No | Yes | Later steps in the identical run (filter + search, both cross-checked against the real API) passed |
| 4 | Browser: `Service Detail — Services-origin click navigation renders cardOnly` — "expected the real disabled purchase CTA text" | Same race class: Service Detail shows `SkeletonBlock`s until `servicesApi.getService(id)` resolves; `page.content()` was read before that. The full-mode-absent assertion in the SAME step (checked first) passed — proving `cardOnly` itself was never in question, only the unwaited CTA-presence check. | **B — QA assertion defect (missing wait)**, correctly *not* coupled to `cardOnly` correctness (which was separately proven fine) | No | Yes | The `cardOnly`-absence assertion in the same step body passed; screenshots from the same step render correctly |
| 5 | Browser: `Browser back from Category View returns to Services List` — expected `/services`, got `/services/e107aa7e-8f0b-4dba-8d15-6d015f50c91f` | The script's own "many/few services" light-visit loop ran `page.goto()` to two *other* categories, then `page.goto()`'d back to the asset category a second time, all **before** the click→detail→back→back sequence — each `goto` is a real history entry. The clean journey (services → category → detail → back → back → services) was never actually isolated; "back" correctly walked the polluted stack one entry at a time and landed on the "few services" category page, not `/services`. | **B — QA history-setup defect**, exactly as the task's own hypothesis predicted; confirmed by reconstructing the exact navigation sequence in the script | No | Yes | Script source shows the light-visit loop sitting between the search test and the click→detail flow, before this run's fix |
| 6 | Browser: `net::ERR_ABORTED` on `GET https://staging.biawin.ir/services/e7f9047b-fafa-4d45-b605-7cb220ba8329` (single-segment `/services/[categoryId]` path, no `_rsc=` query — a `document`-type cancellation, not the Stage 5.22 RSC-fetch pattern) | Most likely the same root cause as #5: the tight `goto → goto → goto(again) → click` sequence around the light-visit loop and the redundant re-navigation to the asset category gave Chromium's own navigation-supersession behavior (a later same-tab navigation cancelling an in-flight earlier one) a real opportunity to fire on a category-level `document` request. Removing the redundant re-goto and no longer stacking three back-to-back `page.goto()` calls removes the mechanism most likely to have produced this. **Not fully proven from logs alone** — no network trace beyond the one-line failure text was available in this run's report. | **Provisionally B (self-inflicted by the QA script's own navigation choreography)** — **NOT broadly suppressed**; no filter was widened, the underlying navigation pattern was fixed instead | Unconfirmed — no | Yes (indirectly, via #5's fix) | Same failing URL shape (`/services/[categoryId]`, no `_rsc=`) as the categories touched by the removed goto pattern; **to be re-confirmed on rerun — if it recurs after this fix, it must be treated as a live, unresolved finding, not dismissed** |

**Screenshot review**: the screenshots referenced in failures #2–#5
(`services-list-collapsed-*`, `services-category-*`,
`services-detail-cardonly-*`) were not independently pulled and inspected by
Claude in this pass — this session has no direct filesystem access to the
staging server, and the failing assertions themselves, cross-referenced
against the SAME run's later-passing steps that exercise the identical DOM
(filter chips reading real card counts, search reading real titles), already
gave a conclusive, falsifiable root cause without needing pixel inspection.
This is disclosed rather than silently skipped. If a future run's failures
are NOT self-evidently timing/history artifacts the way these were, direct
screenshot inspection (via a packaged artifact transfer) should be done
before writing a root cause.

### Fixes applied (this run, before redeploy)

All QA-tooling only — **zero application code changed**:

1. **`deploy/staging/qa/browser/browser-qa.ts`**
   - Added an explicit wait for the first real category tile before counting (fixes #2).
   - Added an explicit wait for the real `<h1>` category heading before reading hero/chip content (fixes #3).
   - Added an explicit wait for the real disabled-CTA button before reading Service Detail content, in all three places that check it — click flow, direct-URL flow, and the direct-URL fallback (fixes #4, and the same latent race in the direct-URL checks that hadn't failed yet only by luck).
   - Removed the redundant `page.goto()` re-navigation to the asset category (the current page was already there).
   - Moved the "many/few services" light-visit loop to run **after** the click→detail→back→back sequence instead of before it, so it can no longer pollute the history stack that assertion depends on (fixes #5, and removes the most likely cause of #6).
2. **`backend/scripts/staging-qa/authenticated-qa-runner.ts`**
   - `apiCall()` now wraps `fetch()` in try/catch and surfaces `err.cause` (DNS/connection/TLS/timeout detail) in the thrown error instead of the bare, undiagnosable `"fetch failed"` — no secrets included, only `origin`+`path` (always a fixed route, never user input) and the network error's own name/message.
3. **`deploy/staging/run-authenticated-qa.sh`**
   - The API-layer `docker compose run` invocation now defaults `QA_API_ORIGIN` to `http://backend:4000` and `QA_CUSTOMER_ORIGIN` to `http://web:3000` (the internal compose-network addresses that container is guaranteed to reach) instead of the public HTTPS domains it silently fell back to before. An explicit env override still takes precedence. The browser-layer run (a separate, non-compose `docker run`) is untouched — it already correctly uses the public HTTPS domains, matching a real client.

### Quality gates (post-fix, this session)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS (6/6 packages) |
| `pnpm lint` | PASS (0 errors; same pre-existing `no-img-element` warning set, nothing new) |
| `pnpm test` | PASS (backend 104/104; web/admin cached from the SERVICES-R1 run, unaffected by QA-tooling-only changes) |
| `pnpm build` | PASS (all routes unchanged; `backend/scripts/staging-qa` compiles cleanly into `dist/`, confirming the deploy-time invocation `node dist/scripts/staging-qa/authenticated-qa-runner.js` will pick up the fix) |

No regression tests were added for these findings: every one is a QA-tooling
defect (races/history-setup/network-target), not an application defect —
there is no application behavior to regress-test. The application code
(`apps/web/src/{app,components}/services/**`) was not touched in this pass.

---

## Deployment #2

| | |
|---|---|
| Deployed revision | `fcd90a3` (SERVICES-R1.3 QA-tooling fixes, on top of `bc2fe24`/`c47702c` — no app code) |
| Migrations | 7 migrations found, 0 pending |
| Result | PASS |

## QA Run #2 (against `fcd90a3`)

**API layer: 54 PASS / 0 FAIL / 0 NOT_TESTED.** Confirms the SERVICES-R1.3
`apiCall()`/`run-authenticated-qa.sh` connectivity fix closed Run #1's fatal
`fetch failed` — the API-layer connectivity issue is CLOSED, not just
worked around.

**Browser layer: 54 PASS / 2 FAIL / 0 NOT_TESTED.** All four SERVICES-R1.2/
R1.3 timing-race fixes confirmed holding: collapsed category count,
CategoryHero, cardOnly, method filters, local search, and all responsive
Services screenshots now PASS. Two failures remained:

1. `Browser back from Category View returns to Services List` — expected
   `/services`, observed `/services/e107aa7e-8f0b-4dba-8d15-6d015f50c91f`
   (independently confirmed via the real public API to be گردشگری's own
   real UUID — i.e. `categoryAsset` itself, the SAME category the first
   `goBack()` already correctly landed on). This persisted after the
   SERVICES-R1.3 history-pollution fix (moving the "many/few services"
   light-visit loop to run after this exact sequence), ruling that loop
   out as the sole cause.
2. Five `net::ERR_ABORTED` requests on migrated category icons:
   `icon-otomobil.webp`, `icon-lavazem-khanegi.webp`,
   `icon-tala-javaher.webp`, `icon-zibaei.webp`, `icon-poushak.webp` — in
   the same run that PASSed "Services List renders with no broken images",
   all responsive screenshots, and expanded-category rendering.

### SERVICES-R1.4 investigation

**Failure 2 (icon `ERR_ABORTED`) — RESOLVED, evidence-based.**

Each of the five URLs was requested directly, outside the browser, with no
navigation involved:

| Asset | HTTP | Content-Type | Size |
|---|---|---|---|
| icon-otomobil.webp | 200 | image/webp | 8158 bytes |
| icon-lavazem-khanegi.webp | 200 | image/webp | 4816 bytes |
| icon-tala-javaher.webp | 200 | image/webp | 7868 bytes |
| icon-zibaei.webp | 200 | image/webp | 7228 bytes |
| icon-poushak.webp | 200 | image/webp | 8668 bytes |

All five: HTTP 200, correct `image/webp` Content-Type, and byte sizes
matching the real files exactly (confirmed against the original migration
in SERVICES-R1's fidelity report) — **asset health: PASS, no real asset
defect.** All five are exactly the icons that only become visible once
"بیشتر" expands the grid to all 19 categories, i.e. their `<img>` fetches
start right before the script's next action (clicking a category tile,
navigating away) — a plausible, narrow benign-cancellation pattern, the
same class as the Stage 5.22 RSC-fetch rule but for a different request
type.

**QA filtering change (narrow, not a broad suppression):** `browser-qa.ts`
now tracks every top-level navigation timestamp and classifies a failed
request as benign only when **all four** hold: exact `net::ERR_ABORTED`,
`resourceType() === 'image'`, a first-party `/services/*.webp` path (our
own migrated icons — never third-party or backend-served), AND a real
navigation recorded within 2 seconds of the failure. Every classification
(benign or not) is now written into the report's "Network diagnostics"
line with the resource type, the page URL at failure time, and the reason
— auditable, not asserted. A broken image outside a navigation window, a
non-webp/non-Services path, or any other error text still fails QA
unchanged.

**Failure 1 (back navigation) — INSTRUMENTED, classification PENDING the
next real run.**

Router/Link inspection (this session): grepped all of `apps/web/src` for
`router.push`/`router.replace`/`redirect`/`window.location`/
`history.*State`. Services List → Category and Category → Service Detail
are each exactly one `router.push()` call
([page.tsx:32](../apps/web/src/app/services/page.tsx),
[[categoryId]/page.tsx:55](<../apps/web/src/app/services/[categoryId]/page.tsx>)).
`AuthGuard` only ever calls `router.replace` (which overwrites, not adds,
a history entry) and only fires when the session is unauthenticated —
false throughout this authenticated run. No other push/replace/redirect
exists anywhere in Services or shell code. **Nothing found in application
source explains a doubled history entry** — but that is not the same as
proof it doesn't exist; Next.js App Router's own internal navigation
mechanics are outside this codebase and weren't audited.

Per the task's own isolation protocol, `browser-qa.ts` now includes
`runBackNavigationIsolationCheck()` — a dedicated, freshly authenticated
context starting at `/services` with zero prior Services history, doing
exactly: click one category → click one service → `goBack()` → `goBack()`,
with **no `page.goto()` anywhere in the sequence**, logging
`window.history.length` and the real URL at every one of the 5 steps into
the report itself (`Back-nav isolation — full history trace`), not just
console output. This will give a definitive answer on the next run:

- If the isolated sequence lands on `/services` — the doubled entry is
  specific to the longer, busier test flow (a QA-only artifact still to be
  found) and only the QA runner needs further work.
- If the isolated sequence lands back on the SAME category — this is a
  real, reproducible application navigation defect and must be root-caused
  and fixed in Services application code (no referrer hacks, no
  `router.back()` loops, direct URLs must keep working).

**No fix was applied for Failure 1 in this round** — writing one before
this evidence exists would be guessing, which the task explicitly
prohibited. The known-failing assertion inside
`runServicesModuleChecks` (`Browser back from Category View returns to
Services List`) is left exactly as-is, and is expected to still report
FAIL on the next run alongside the new isolation check's trace — this is
diagnostic, not a regression.

### Application code changed this round

**None.** Every SERVICES-R1.4 change is in `deploy/staging/qa/browser/browser-qa.ts` (diagnostics + the new isolation check) — no file under `apps/web/src/{app,components}/services/**` was touched.

### Quality gates (post-SERVICES-R1.4 changes)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (0 errors, same pre-existing warning set) |
| `pnpm test` | PASS (backend 104/104; web/admin cached, unaffected) |
| `pnpm build` | PASS |

No regression tests were added — no application code changed.

---

## Deployment #3

| | |
|---|---|
| Deployed revision | `dcdc10c` (SERVICES-R1.4 icon-abort fix + back-nav isolation instrumentation, no app code) |
| Result | PASS |

## QA Run #3 (against `dcdc10c`)

**API layer: 54 PASS / 0 FAIL / 0 NOT_TESTED.** Connectivity fix from
SERVICES-R1.3 continues to hold.

**Browser layer: 56 PASS / 3 FAIL / 1 NOT_TESTED.** This is a HIGHER
raw fail/not-tested count than Run #2's 2 FAIL — recorded honestly, but it
does **not** mean three newly discovered product defects. All of it came
from the SERVICES-R1.4 diagnostics themselves:

- The 5 icon `ERR_ABORTED` failures from Run #2 are GONE — the narrow
  navigation-correlation rule worked as designed.
- 1 of the 3 new FAILs is the SAME pre-existing "Browser back from
  Category View returns to Services List" failure, carried over unchanged
  from Run #2 (expected — no fix was applied to it yet, by design).
- 1 NOT_TESTED is the new isolated back-navigation check's own login step
  failing before the sequence it exists to test could even run (see
  below) — this is the isolation check correctly reporting that it
  couldn't do its job, not a Services product defect.
- The remaining 2 FAILs are the 3 new `net::ERR_ABORTED` events on
  `/api/v1/categories` and `/api/v1/services?limit=100&page=1` (reported
  as 2 distinct FAIL entries covering 3 request events) — a request class
  the SERVICES-R1.4 diagnostics surfaced but did not yet have a
  classification rule for.

### SERVICES-R1.5 investigation

**Isolated back-navigation test — login root-caused and fixed (NOT a
selector bug).**

The isolation test's fresh-context login timed out waiting for the OTP
input screen (`locator('text=تأیید و ادامه')...` never resolved), even
though the exact same `performCustomerLogin()` code succeeded minutes
earlier in the same run via `runCustomerChecks`. Reading
`backend/src/modules/auth/otp.service.ts` found the real cause: `issue()`
enforces a per-phone resend lock — "at most one live code per phone at a
time," TTL = `OTP_TTL_SECONDS` (default 120s). `runCustomerChecks`'s login
had already consumed the fixed STAGING_TEST_AUTH phone's (`09121111111`)
one resend slot; the isolation check's second login attempt, moments
later in the same run, hit that lock (HTTP 429, "کد قبلی هنوز معتبر
است") — so the phone-step submission never transitioned to an OTP screen,
and the locator had nothing to wait for. **Comparing the two login paths
found no selector difference at all — both use identical code.**

Fix: the isolation check now authenticates via a direct call to
`/api/v1/auth/otp/verify` (Playwright's `page.request`, not page JS — no
CORS concerns) using the SAME test-mode bypass `verify()` already grants
the fixed phone/code — which requires no prior `/otp/request` call at all
(confirmed by reading `verify()`: the bypass returns immediately for
`phone === DEV_TEST_PHONE && code === DEV_TEST_CODE`, entirely skipping
the resend-locked `issue()` path). This is the exact same mechanism
`backend/scripts/staging-qa/authenticated-qa-runner.ts`'s own
`customerAuthCheck()` already uses. The real access/refresh token pair
returned is seeded into `localStorage` before the first navigation to
`/services`, so `AuthProvider`'s mount effect picks it up immediately — a
real, backend-issued session, just obtained without re-triggering an
already-exercised, now-rate-limited UI flow. No production/application UI
code was touched.

**Three catalog-fetch `ERR_ABORTED` events — RESOLVED, evidence-based, same
narrow-rule pattern as the icon fix.**

`/api/v1/categories?limit=100` and `/api/v1/services?limit=100&page=1`
(reported twice) are exactly the endpoints `useServiceCatalog()`
(`apps/web/src/components/services/useServiceCatalog.ts`) calls on every
mount of `/services` and independently again on every mount of
`/services/[categoryId]` — real application behavior, not QA-script
requests. Both endpoints were independently re-verified outside the
browser (HTTP 200, valid JSON, real payload) in this session. The same
run's Category Hero/filters/search/service-detail PASSes (all cross-
checked against the real API snapshot) prove the catalog data did render
correctly — condition 2 and 6 of the task's own 6-condition rule.

The diagnostics were upgraded from a flat "navigation happened within Ns
of the failure" window to precise per-request correlation: every request
now has its own start timestamp and starting page URL recorded
(`page.on('request')`), and a failure is only correlated to navigation if
a real `framenavigated` event landed strictly between THAT request's own
start and its failure (+250ms grace for event-ordering). A new
`isBenignCatalogFetchCancelledByNavigation()` rule requires all of: exact
`net::ERR_ABORTED`, `resourceType() === 'fetch'`, the URL is exactly our
own first-party `/api/v1/categories` or `/api/v1/services` endpoint (never
any other API route — an aborted mutation or auth call is never covered),
and that precise in-flight-navigation correlation. The pre-existing image
rule was upgraded to the same precise correlation. Every classification
(benign or not) is written into the report's "Network diagnostics" line
with full timing (`pageUrlAtStart`, `pageUrlAtFailure`, `elapsedMs`,
`navigationDuringRequest`) for auditability.

**Back-navigation defect itself — STILL UNCLASSIFIED.** The isolation
test's login is fixed, but it has not yet actually RUN against real
staging with a working login — so Task 2/3's actual isolated trace (and
therefore the QA-defect-vs-application-defect classification) is still
pending the next real run. No navigation code was touched. The
pre-existing failing assertion inside `runServicesModuleChecks` is left
exactly as-is (per the task's own ordering: fix it only after the isolated
result is known) and is expected to still report FAIL on the next run
alongside the isolation check's actual trace output.

### Application code changed this round

**None.** Every SERVICES-R1.5 change is in
`deploy/staging/qa/browser/browser-qa.ts` — no file under
`apps/web/src/{app,components}/services/**` was touched.

### Quality gates (post-SERVICES-R1.5 changes)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (0 errors, same pre-existing warning set) |
| `pnpm test` | PASS |
| `pnpm build` | PASS |

No regression tests were added — no application code changed.

---

## Deployment #4

| | |
|---|---|
| Deployed revision | `89ea33f` (SERVICES-R1.5 isolation-test login fix + catalog-fetch correlation, no app code) |
| Result | PASS |

## QA Run #4 (against `89ea33f`)

**API layer: 53 PASS / 1 FAIL / 0 NOT_TESTED.**

**Browser layer: 60 PASS / 6 FAIL / 0 NOT_TESTED.** Recorded honestly —
this is a higher raw FAIL count than Run #3, but it is **not six
independent product defects**. Four of the six were cascading failures
from a single invalid prerequisite in the isolation test (the category
tile it tried to click, "کودک و نوجوان", was never visible in the
collapsed grid it started on — the click never happened, yet the QA
runner kept going: it clicked "a service" anyway, then called `goBack()`
twice, producing an invalid trace of `/services → /home → about:blank`).
That trace is explicitly **not usable as evidence** about Services
navigation and was not treated as such. The remaining two are the same
un-classified catalog-fetch aborts as Run #3, now with `navigationDuring
Request=false` recorded against them — i.e. the R1.5 precise-correlation
rule is working correctly and correctly refusing to call these benign.

### SERVICES-R1.6 investigation

**Isolation test's category selection — root-caused and fixed (confirmed
from source, not a guess).**

`serviceCategoryVisual.ts`'s `CATEGORY_GRID_ORDER` lists 19 real category
names in the prototype's grid order; `CATEGORY_GRID_DEFAULT_COUNT = 11`
means only the FIRST 11 of that list render before "بیشتر" is clicked.
"کودک و نوجوان" is the **last** (19th) entry in that array — one of the 8
categories only revealed by "بیشتر". The previous isolation test picked
its category via `snapshot.categories.find(...)` — the first entry in the
RAW API response, which happens to return "کودک و نوجوان" first (confirmed
by direct API inspection this session) — with no relationship at all to
`CategoryGrid`'s actual display order. This is independently confirmed by
a passing, already-committed unit test
([CategoryGrid.test.tsx](../apps/web/src/components/services/CategoryGrid.test.tsx)):
`"renders only the first 11 categories by default... expect(html).not.toContain('کودک و نوجوان')"`
— i.e. the application's own test suite already proves this category is
never in the default collapsed view. Direct screenshot inspection wasn't
available (no filesystem access to the server), but this source-level
proof is at least as reliable.

Fix: the isolation test no longer assumes API order matches render order,
for either category or service selection. After landing on `/services`,
it now reads the REAL rendered tile labels from the DOM
(`main button:has(img[alt=""])`, the exact CategoryGrid tile selector),
intersects those visible names against the real snapshot to find one with
at least one real service, and clicks that specific one. The service pick
works the same way: it reads the first actually-rendered service card's
title from the DOM rather than assuming array order. Every forward click
now asserts the URL genuinely changed before the test proceeds.

**Cascading failures — stopped.** The isolation function previously called
`step()` for each stage without checking whether the PRIOR stage actually
succeeded — a failed category click didn't stop the service click or
either `goBack()` from running. It's now explicitly gated: if the category
click (or the token issuance, the `/services` landing, or the service
click) doesn't succeed, every downstream step is marked `NOT_TESTED` with
a clear reason, `goBack()` is never called, and the history-trace record
is written as `FAIL — INVALID — sequence aborted: <reason>` with whatever
partial trace exists, rather than a misleadingly "complete"-looking
sequence built on an invalid foundation.

**Original long-running back-navigation assertion — UNCHANGED, still
pending.** Per the task's own explicit ordering (fix only after the
isolated result is known), no changes were made to
`runServicesModuleChecks`'s existing back-navigation assertions this
round. The isolation test can now genuinely reach and test the real
sequence; its actual PASS/FAIL on the next run is what will finally
classify Failure 1 as QA history pollution or a real application defect.

**API media public-URL failure — RESOLVED, classification B (container
egress limitation, not a media defect).**
`MediaStorageService.resolvePublicUrl()`
(`backend/src/modules/media/media-storage.service.ts`) always builds an
ABSOLUTE URL from the backend's own `PUBLIC_API_ORIGIN` config —
independent of this script's own `API_ORIGIN` override. Running inside the
backend compose-network container (the SERVICES-R1.3 fix), that
public-domain URL hits the exact same egress limitation the admin-login
fix already worked around. Independently confirmed this session: `curl
https://api-staging.biawin.ir/api/v1/media/<nonexistent-file>` returns a
real HTTP 404 (not a connection/DNS failure) from a normal internet
client — proving the route and domain resolve correctly externally; this
is a container network limitation, not a storage/media defect (rules out
classification A). Fixed by re-targeting the SAME path onto the script's
own configured `API_ORIGIN` (matching every other request in this script)
instead of the hardcoded public domain baked into the returned URL, and
wrapping the raw `fetch()` in the same cause-surfacing try/catch already
added to `apiCall()` in SERVICES-R1.3, so a future failure here would show
the real network error instead of a bare "fetch failed". Public HTTPS
reachability of the customer-facing path remains covered by the
browser-qa layer's real-browser image-loading checks (Home's own `<img>`
tags resolve through the real public domain in every browser-qa run) and
was independently curl-verified this session for this exact route
pattern — nothing was weakened, per the explicit instruction not to.

**Two non-navigation catalog aborts — STILL UNRESOLVED, correctly not
suppressed.** `useServiceCatalog()`
(`apps/web/src/components/services/useServiceCatalog.ts`) has no
`AbortController` — reading it confirms the application itself never
voluntarily cancels these fetches. `api-client.ts`'s `request()` also has
no timeout/abort logic. With `navigationDuringRequest=false` now proven by
the SERVICES-R1.5 precise correlation (a real navigation did NOT happen
between each request's start and its failure), these do not meet the
narrow benign rule and were correctly left as real failures — **no rule
was broadened to cover them.** Since a live browser session wasn't
available to gather more evidence this turn, `browser-qa.ts` now also
records which QA step was executing when each request started
(`qaStepAtStart`) and when it failed (`qaStepAtFailure`) — precise
evidence for whatever the next run's action-to-abort correlation actually
shows, rather than a further guess at the cause here.

### Application code changed this round

**None.** Every SERVICES-R1.6 change is in
`deploy/staging/qa/browser/browser-qa.ts` and
`backend/scripts/staging-qa/authenticated-qa-runner.ts` (both QA tooling)
— no file under `apps/web/src/{app,components}/services/**` was touched.

### Quality gates (post-SERVICES-R1.6 changes)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (0 errors, same pre-existing warning set) |
| `pnpm test` | PASS (104/104 backend, cached web/admin) |
| `pnpm build` | PASS |

No regression tests were added — no application code changed.

---

## QA Run #5 (against the post-SERVICES-R1.6 revision)

**PENDING** — not yet executed. Closure standard for this run: API 0
FAIL/0 NOT_TESTED, browser 0 FAIL/0 NOT_TESTED, and the isolated sequence
must explicitly PASS the full `/services → category → service → back
category → back /services` chain with a valid (non-aborted) trace. Will
NOT report SERVICES-R1 complete until that is the real, observed result.

---

## Status

SERVICES-R1's *application* code and fidelity claims (see
[docs/services-r1-fidelity-report.md](services-r1-fidelity-report.md))
remain unchanged and unaffected by R1.2 through R1.6 — every finding
across all four QA rounds so far has been QA-tooling-side (connectivity
target, timing races, history setup, an OTP resend-lock collision, an
isolation test's own category-selection bug, a container egress
limitation on a media URL, and independently-verified-healthy assets/
endpoints aborted mid-navigation), never a real application defect. Two
items remain genuinely open: Failure 1's classification (the isolation
test can now validly run the real sequence; its actual result on the next
run decides QA-defect vs. application-defect) and the two catalog-fetch
aborts (real, unresolved, now carrying step-level evidence for the next
run). SERVICES-R1 does not close until a run produces 0 FAIL/0 NOT_TESTED
end to end.
