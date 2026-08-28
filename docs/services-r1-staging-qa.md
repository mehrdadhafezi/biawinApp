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

## QA Run #2 (against the post-fix revision)

**PENDING** — not yet executed as of this document's last update. This
section will be filled in with the real second-run results (API layer +
browser layer, PASS/FAIL/NOT_TESTED counts, any newly surfaced findings)
once the redeploy + QA rerun actually happens. It will NOT report PASS
here until that real run has completed.

---

## Status

SERVICES-R1's *application* code and fidelity claims (see
[docs/services-r1-fidelity-report.md](services-r1-fidelity-report.md)) are
unchanged by this document — nothing here found an application defect.
This document's open item is purely: **re-run the authenticated staging QA
against the fixed QA tooling and confirm a clean pass**, which has not
happened yet.
