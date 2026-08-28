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

## QA Run #3 (against the post-SERVICES-R1.4 revision)

**PENDING** — not yet executed. Will record the real API-layer and
browser-layer results, the back-nav isolation trace's actual output, and
whatever classification that trace supports, once the redeploy + rerun
happens. Will NOT report a final PASS here until that real run completes
and Failure 1 has an evidence-backed classification and (if needed) a fix.

---

## Status

SERVICES-R1's *application* code and fidelity claims (see
[docs/services-r1-fidelity-report.md](services-r1-fidelity-report.md))
remain unchanged and unaffected by any of R1.2/R1.3/R1.4 — every finding so
far has been QA-tooling-side (connectivity target, timing races, history
setup) or independently-verified-healthy assets, never an application
defect. The one open item is Failure 1's root cause, which now has a
purpose-built, evidence-generating test in place; its classification and
any resulting fix are pending that test's actual output on the next real
staging run.
