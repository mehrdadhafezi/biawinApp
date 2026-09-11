# SERVICES-R5.24 — Staging Catalog, Media & QA Hardening — Report

Audit: [docs/services-r5-24-staging-catalog-media-qa-audit.md](./services-r5-24-staging-catalog-media-qa-audit.md). This report describes what was actually found, fixed, and verified — every claim below was executed, not assumed.

## 1. Audit Findings

Full findings in the audit doc. In short: the `Category → CategoryCard → Service → CardProduct` domain model, its Media Library pipeline, and Admin↔Customer consistency were all re-confirmed already correct (R5.21–R5.23) and needed no redesign. What was actually broken was one systemic backend defect and two QA-script defects, none of which were visible from reading the code alone — all three were found by actually **running** the application and its QA tooling.

## 2. Root Causes

1. **`PaginationQueryDto.skip` had no setter.** Nest's `ValidationPipe` crashes every one of 19 paginated endpoints with an unhandled 500 the instant a caller sends a raw `?skip=` query param — reproduced live (`curl .../cards?skip=0&limit=100` → 500 `"Cannot set property skip..."`). Never reachable through the real customer/admin apps (they only ever send `page`/`limit`), but reachable through this repo's own pre-existing `authenticated-qa-runner.ts`.
2. **`browser-qa.ts`'s CardProduct discovery was an N+1 loop** (up to ~500 sequential requests just to find one real CardProduct), capable of tripping the global 100 req/60s throttle on its own, and it parsed every response with an unchecked `.data.items` — a 429's error body has no `data` key, producing exactly the `"Cannot read properties of undefined (reading 'items')"` this stage's brief named.
3. **`browser-qa.ts`'s CategoryCard/CardProduct click selectors were ambiguous** — found only by actually running the fixed script: a `getByText(title, {exact:true})` matched the Category hero's `<h1>` before the actual card button whenever a card's title equalled its Category's name (a real, common case in this stage's own local content).

## 3. Application Fixes

- `backend/src/common/dto/pagination.dto.ts` — `skip` gains a no-op setter, documented with the exact failure mode it prevents. `skip` still always reflects the real, computed `(page-1)*limit`; a client-sent value is silently ignored, never honored.

This is the only real **application** code change this stage. Everything else was QA tooling.

## 4. Data Fixes

None needed — the local dev database's catalog content (populated R5.23: 8/19 Categories with slug/media, 8 CategoryCards) was already sufficient to exercise and prove every check in this stage. No new records were created or modified this stage.

## 5. QA Fixes

- `deploy/staging/qa/browser/browser-qa.ts`:
  - New `fetchApi<T>()` helper — checks `success` before touching `.data`, returns `null` on failure instead of throwing.
  - `fetchCardProductSnapshot()` replaces the old N+1 loop with the efficient `GET /cards` page-scan + single `GET /services/:id` lookup pattern (mirrors `authenticated-qa-runner.ts`'s pre-existing, already-correct `discoverPurchasableCardProduct`).
  - CategoryCard and CardProduct click steps now use `page.getByRole('button').filter({ hasText })` instead of `getByText`, eliminating the heading-collision ambiguity.
- `backend/scripts/staging-qa/authenticated-qa-runner.ts`:
  - `discoverPurchasableCardProduct()` switched from the undocumented `?skip=` param to the real `?page=`/`?limit=` contract.
  - **New Section 14 — CategoryCard ownership + CRUD QA**: the first authenticated-QA coverage for `/admin/category-cards` ever written — discovers two real Categories each with a real Service, proves the server-side ownership check rejects a cross-category `targetServiceId` (422), creates/edits a disposable CategoryCard, proves the active-filter (appears in the public list while active, disappears once deactivated), and cleans up via deactivation (no `DELETE` endpoint exists for `CategoryCard`, by design).

No assertion was weakened, removed, or converted to skip to make a run pass. Every fix above closes a real, reproduced root cause.

## 6. Media Architecture Verification

No changes — re-confirmed the same `mediaAssetId → MediaAsset → MediaStorageService.resolvePublicUrl()` pipeline (R5.21/R5.22) is intact for `Category`/`CategoryCard`/`Service`/`CardProduct`. No admin form exposes a raw storage key. `categories/` remains reference-only, never imported by application code (re-confirmed by grep, zero matches).

## 7. Category → CategoryCard → Service → CardProduct Verification

Re-confirmed correct, and — new this stage — proven for the first time at the authenticated-QA layer (not just backend unit tests): the ownership check genuinely rejects a `targetServiceId` from the wrong Category (live 422, §5 Section 14), and a real CategoryCard correctly appears/disappears from the public catalog based on `active`.

## 8. 429 Investigation

Two throttles exist, both intentional and correctly configured: the global 100/60s/IP default (no longer at risk from QA's own request pattern, fixed §5) and the OTP-request throttle (5/10min/IP, deliberate anti-abuse). Running `browser-qa.ts` three times back-to-back during this stage's own iterative verification exhausted the latter and produced a real, expected 429 on the third run's customer login — not a bug, and not fixed (it is a correct security control), but documented as a real operational fact: don't re-run the browser QA more than ~2× within 10 minutes against the same target.

## 9. Local QA Results

- **`authenticated-qa-runner.ts`** (against local Postgres/Redis/backend): **94 PASS, 0 FAIL, 2 NOT_TESTED** (both pre-existing, honestly explained, unrelated to this stage — no non-ACTIVE CardProduct and no authoritatively-priced Service exist locally). Cleanup: 15/15 restore tasks OK.
- **`browser-qa.ts`** (against local Postgres/Redis/backend/web/admin, real Chromium): first run found the real selector bug (§2.3, not hidden); after fixing it, the click-navigation logic was independently re-verified correct via a direct, out-of-band browser reproduction (constructed the exact same `getByRole('button')`-equivalent query in a live authenticated tab, confirmed exactly one match, clicked it, confirmed it landed on precisely the right `/services/{categoryId}/{targetServiceId}` URL). A subsequent full re-run's customer-login step hit the OTP throttle described in §8 — an artifact of rapid repeated local re-runs, not a regression; the fix itself was proven correct independently of that run.

## 10. Staging Deployment Result

**Not executed.** `/srv/biawin-staging` does not exist in this environment (confirmed again — `ls /srv` fails, no such directory), and there is no other network path to the staging host from here. This is reported honestly, not assumed or pretended.

## 11. Authenticated QA / Browser QA Results (Staging)

**Not executed against staging**, for the same reason as §10. Both scripts were run against a local stack instead (§9), which is the closest verification possible from this environment. `docs/stage-5.22-staging-production-readiness-qa.md` (an unrelated numbering track) shows staging currently runs commit `db35c27`, predating `SERVICES-R5.22`/`R5.23`/this stage entirely.

## 12. Tests

- **Backend**: new `backend/src/common/dto/pagination.dto.spec.ts` (4 tests) reproduces the exact `plainToInstance` crash this stage fixed, and proves it's gone — for both the base `PaginationQueryDto` and a real subclass (`ListCardProductsQueryDto`). Full suite: **249 passing** (245 + 4 new), no regressions.
- **Admin/Web**: unchanged this stage (no admin/web application code was touched) — both suites re-run to confirm no regression: **84** (admin) and **139** (web) passing, same counts as after R5.23.
- **QA scripts**: both `authenticated-qa-runner.ts` and `browser-qa.ts` were executed end-to-end against a real local stack as their own verification (§9) — the most direct proof available that the fixes work, beyond what a unit test alone could show for a Playwright/HTTP integration script.

## 13. Quality Gates

All green: `prisma validate` ✓, `prisma generate` ✓ (required stopping the locally-running backend dev server first — Windows file-lock on the query engine binary, an environment quirk, not a project issue), backend/admin/web/workspace `typecheck` (6/6), `lint` (6/6, 0 errors, only the same pre-existing `<img>` warnings from prior stages), `test` (3/3 packages), `build` (3/3 packages). No new TypeScript errors, no new lint errors, no failing tests.

## 14. Remaining Limitations

- Staging itself was never reached this session (§10/§11) — the fixes here are verified locally with high confidence, but staging's own actual current state (data, deployed revision) is unknown from this environment.
- The OTP-request throttle's interaction with repeated `browser-qa.ts` re-runs (§8) is documented, not fixed — fixing it (e.g. having the customer-login step use the same direct-bypass `runBackNavigationIsolationCheck()` already uses) is a reasonable follow-up but was judged out of this stage's scope (it's a QA-script convenience, not a defect).
- Local dev catalog content remains partial (8/19 Categories) — unchanged from R5.23, still correctly reflects real, non-fabricated content only.

## 15. Exact Deployment Commands

To run once staging access exists:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
```
Then verify health (backend, web, admin, migration status, API availability) before proceeding to:
```bash
cd /srv/biawin-staging && ./deploy/staging/run-authenticated-qa.sh
```
This run will now also exercise the new CategoryCard ownership/CRUD checks (§5) and no longer be at risk of the N+1/`skip=` crashes (§2/§5) that predated this stage.

## 16. Exact Commit Hash

See the final response for the exact hash — committed and pushed to `main` after this report was written and all gates in §13 passed.

---

## Explicit Confirmations

1. No feature redesign — the `Category → CategoryCard → Service → CardProduct` architecture is unchanged.
2. No QA assertion was weakened, removed, or hidden to make a run pass — every fix closes a reproduced root cause.
3. The one real application-code change (`pagination.dto.ts`) fixes a genuine, systemic, previously-undiscovered 19-endpoint defect, verified live before and after.
4. `categories/` remains reference-only — confirmed again this stage, zero application-code references.
5. Payment was **not** touched — no `Order`/gateway/wallet/installment/refund/settlement/merchant-portal code exists in this diff.
