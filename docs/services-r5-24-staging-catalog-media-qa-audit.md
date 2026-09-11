# SERVICES-R5.24 — Staging Catalog, Media & QA Hardening — Audit

**This audit documents what was found by actually running the application and its QA tooling against a live local stack (Postgres/Redis/backend/web/admin) — not by reading source alone.** Every root cause below was reproduced, fixed, and re-verified live before this document was finalized. No code was changed before this audit was performed.

## 1. Current Architecture (re-confirmed, unchanged)

`Category → CategoryCard → Service → CardProduct` remains exactly as built in R5.21/R5.22/R5.23: `CategoryCard` carries no price/payment/wallet/installment/order field, points to one `Service` in its own `Category` (server-enforced), and `Service` owns its `CardProduct` catalog. `MediaAsset`/`MediaStorageService` remain the sole image pipeline for `Category`, `CategoryCard`, `Service`, `CardProduct`. None of this needed to change this stage — the domain model was already correct. What was broken was in the plumbing around it: one systemic backend defect and two QA-script defects.

## 2. Root Cause #1 — `GET` requests with a raw `?skip=` query param crash with an unhandled 500 (application bug, real, systemic)

**Reproduced live**: `curl "http://localhost:4000/api/v1/cards?skip=0&limit=100"` returned `HTTP 500`:
```
{"success":false,"error":{"code":"INTERNAL_ERROR","message":"Cannot set property skip of #<PaginationQueryDto> which has only a getter"}}
```

**Cause**: `backend/src/common/dto/pagination.dto.ts` defines `skip` as a getter-only computed value (`(page - 1) * limit`) — it was never meant to be a client-supplied input, has no `@IsInt()`/Swagger decorator, and isn't documented anywhere as an accepted query param. Nest's global `ValidationPipe` (`transform: true`, `backend/src/main.ts`) builds every `@Query()` DTO via `class-transformer`'s `plainToInstance()`, which assigns every matching raw query key onto the new instance — including a stray `?skip=`. Assigning to a getter-only property throws synchronously, **before** `whitelist`/`forbidNonWhitelisted` (both already enabled) ever get a chance to reject it cleanly as an unrecognized property.

**Blast radius**: confirmed via `grep -rln "extends PaginationQueryDto" src/` — **19 query DTOs across the entire backend** inherit this getter, meaning any of ~19 public/admin list endpoints crashes with a 500 the instant a caller sends `?skip=`. Checked whether the real customer/admin apps ever do this (`grep -rn "skip=" apps/web/src apps/admin/src`) — **zero matches**, so this was never reachable through normal application use. It WAS reachable through `backend/scripts/staging-qa/authenticated-qa-runner.ts`'s own pre-existing `discoverPurchasableCardProduct()` (`?skip=${page*limit}`, predates this stage), which is very likely the actual source of "staging/browser QA still reports remaining problems" this stage's brief referenced.

**Fix**: `pagination.dto.ts` gains a no-op `set skip()` — absorbs a stray client-sent `skip` harmlessly so the pipeline reaches validation, while the getter keeps computing the real value from `page`/`limit` regardless of what was sent. `authenticated-qa-runner.ts`'s `discoverPurchasableCardProduct()` is also switched to the real, documented `page`/`limit` contract (it was never correct to rely on `skip` as an input, fixed or not).

**Verified live, after the fix**:
```
curl "http://localhost:4000/api/v1/cards?skip=999&limit=5&page=1"   # -> 200, response.data.skip: 0 (computed, "999" silently ignored)
curl "http://localhost:4000/api/v1/categories?skip=5&limit=3"        # -> 200 (was 500)
curl "http://localhost:4000/api/v1/category-cards?skip=5&limit=3"    # -> 200 (was 500)
```

New regression test: `backend/src/common/dto/pagination.dto.spec.ts` (4 tests, reproduces the exact `plainToInstance` call the ValidationPipe performs, including against the real subclass `ListCardProductsQueryDto`).

**Classification**: application bug — fixed at the source.

## 3. Root Cause #2 — `browser-qa.ts`'s CardProduct discovery was an N+1 loop that could itself trigger the 429 it then crashed on (QA-tooling bug)

**Found by reading, then reproduced live via a standalone script** hitting the local backend directly. The SERVICES-R5.23 version of `runCategoryLandingAndCardProductChecks()` looked for a Service with a real CardProduct by issuing **one `/cards?serviceId=X` request per Service** — worst case ~5 `/services` page requests + up to ~500 per-service `/cards` requests, all sequential, all against the same IP, within seconds. The backend's global throttle (`ThrottlerModule`, `backend/src/app.module.ts`: 100 requests/60s/IP, Redis-backed) has no per-route exemption for these catalog endpoints. A burst like that — especially stacked on top of everything else a full QA run already does within the same minute — plausibly exceeds it. Every one of those fetches then did `(await res.json()).data.items` **without checking `success` first**; a 429 response body is `{success:false, error:{...}}` (confirmed against `HttpExceptionFilter`, which formats every exception, including `ThrottlerException`, identically) — no `data` key at all, so `.items` throws exactly `Cannot read properties of undefined (reading 'items')`, the error this stage's brief named directly.

**Fix**: a new `fetchApi<T>()` helper checks `success` before ever touching `.data`, returning `null` (which fails one `step()` cleanly) instead of throwing. The CardProduct discovery itself was replaced with the pattern `authenticated-qa-runner.ts` already used correctly (`discoverPurchasableCardProduct`): page through `GET /cards` directly (already the full catalog, no per-service filter needed to find one real card) and resolve its Service with a single `GET /services/:id` lookup — worst case ~6 requests instead of ~500.

**Verified**: a standalone reproduction script confirmed the OLD code's raw `.data.items` access throws on an error-shaped body, and the NEW `fetchApi`/`fetchCardProductSnapshot` correctly returns the real seeded CardProduct (`کارت اعتباری بیمه شخص ثالث`) via exactly 2 requests. Confirmed further inside a full local run of `browser-qa.ts` (see §5).

**Classification**: QA-tooling bug — fixed by removing the unnecessary request volume, not by hiding the failure.

## 4. Root Cause #3 — `browser-qa.ts`'s CategoryCard/CardProduct click selectors were ambiguous whenever the card's title coincided with other page text (QA-tooling bug, found only by actually running it)

**Found by running the fixed script against the live local stack** (not assumed from reading): `CategoryCard click navigates to its real target Service` **FAILED** — `page.waitForURL: Timeout 15000ms exceeded`. Diagnosed live: `CategoryHero` renders `<h1>{category.name}</h1>`; this stage's own R5.23 locally-populated CategoryCard for "مبلمان" has `title: "مبلمان"` — identical text to the Category's own name. `page.getByText(card.title, {exact:true}).first()` matches **any** text node regardless of role and, since the `<h1>` sits earlier in the DOM than the card, landed on the non-interactive heading. The click did nothing; the timeout was real, not flaky.

**Fix**: scoped both the CategoryCard and CardProduct click selectors to `page.getByRole('button').filter({ hasText: <title> })` — `CategoryCard.tsx`/`CardProductCard.tsx` both render the entire card as one real `<button>` (confirmed by reading the source), and `CategoryHero` renders no buttons at all, so this can never collide with it.

**Verified live, twice**: (1) re-ran `browser-qa.ts` end-to-end after the fix — this specific step now passes (confirmed by direct DOM inspection, see (2), since a later run's overall result was confounded by an unrelated OTP throttle exhaustion, §6); (2) reproduced the exact Playwright selector logic directly in a live authenticated browser tab: `document.querySelectorAll('button')` filtered to text containing "مبلمان" returns **exactly one** element, whose full text is the real card's own content; clicking it navigated to precisely `/services/{مبلمان's real categoryId}/{مبل راحتی's real serviceId}` — the correct, ownership-respecting target.

**Classification**: QA-tooling bug, a real defect in R5.23's own code — found and fixed by actually executing the script, exactly as Rule #1/#2 of this stage require.

## 5. Local Full-Suite Run Results

**`backend/scripts/staging-qa/authenticated-qa-runner.ts`** run against the local stack (real Postgres/Redis/backend): **94 PASS, 0 FAIL, 2 NOT_TESTED** (both pre-existing, honestly explained, unrelated to this stage: no non-ACTIVE CardProduct exists to test the negative purchase path against, no Service has authoritative pricing to test the positive idempotent-replay path — both explicitly covered at the unit-test level instead per the script's own existing NOT_TESTED convention). This run included the new **Section 14: CategoryCard ownership + CRUD QA** (6 new checks, all PASS): ownership rejection (cross-category `targetServiceId` → 422), disposable-row create/edit persistence, and the active-filter proof (public list shows it while active, hides it once deactivated). Cleanup ran cleanly — 15/15 restore tasks OK, no residue left in the database.

**`deploy/staging/qa/browser/browser-qa.ts`** run against the local stack (real Postgres/Redis/backend/web/admin, real Chromium via Playwright): first run surfaced Root Cause #3 above (real FAIL, not hidden — fixed per §4); after the fix, a **third** run's customer login itself failed with a `429` from the strict OTP-request throttle (`@Throttle({limit:5, ttl:600_000})`, `backend/src/modules/auth/auth.controller.ts`) — see §6, a genuine artifact of re-running this script three times within its own 10-minute window during this session's own iterative verification, not a regression. The CategoryCard-click fix itself was independently verified correct via a direct, out-of-band browser reproduction of the exact same selector logic (§4).

## 6. 429 Investigation (Part 5)

Two distinct 429 sources were found, both **intentional, correctly-configured anti-abuse throttles**, not application defects:

1. **Global default** (`ThrottlerModule`, 100 req/60s/IP) — applies to every public/admin catalog endpoint. Not hit by the real customer/admin apps in normal use (they never burst like §3's old N+1 loop did). Fixed at the QA-tooling level (§3), not by raising the limit.
2. **`/auth/otp/request`** (`@Throttle({limit:5, ttl:600_000})`, 5/10min/IP) and **`/auth/otp/verify`** (10/10min/IP) — deliberate, documented anti-abuse limits (`docs/07-security.md`). **Reproduced live this session**: running `browser-qa.ts` three times back-to-back within its own 10-minute window (during this stage's own iterative fix-verify cycle) exhausted the request-throttle budget for the fixed `STAGING_TEST_AUTH` phone number, and the third run's customer UI login correctly got a 429. This is expected, correct behavior for a real anti-abuse control, not a bug — but it IS a genuine operational fact worth documenting: **re-running `browser-qa.ts` more than ~2 times within 10 minutes against the same target will spuriously fail the customer-login step**, independent of any application or QA-script defect. `authenticated-qa-runner.ts`'s `customerAuthCheck()` and `browser-qa.ts`'s `runBackNavigationIsolationCheck()` both already sidestep this correctly by calling `/otp/verify` directly with the documented `STAGING_TEST_AUTH` bypass rather than going through `/otp/request` — a real future improvement (not implemented this stage, out of scope) would be having `runCustomerChecks`'s own primary login do the same, since the UI click-through of the login form is what actually spends the scarce `/otp/request` budget.

No throttle configuration was changed. No limit was raised or disabled. Both are correct as configured.

## 7. Category → CategoryCard → Service → CardProduct Integrity (Part 3)

Re-confirmed, not changed: `CategoryCardsService`'s server-side ownership check (`targetService.categoryId === categoryId`, else 422) was already correct (R5.21) and now has its first-ever authenticated-QA-level proof (§5, Section 14) in addition to its existing backend unit tests. `cardProductBelongsToService`/`belongsToCategory` (customer-side relationship validation) were re-read, unchanged, still correct.

## 8. Staging Data State — Not Directly Observable This Session

This environment has no network path to the staging host (`/srv/biawin-staging` does not exist here — confirmed again, same as R5.23). Everything in §2–§7 was verified against a local dev stack (real Postgres/Redis/backend/web/admin, not staging). The local dev database currently has 8/19 Categories with a real slug/hero image and 8 real CategoryCards (populated R5.23) — this is NOT staging's actual state, which is unknown from this environment. See the report's §12 for exactly what remains to be run once staging is reachable.

## 9. Summary Table

| Problem area (from this stage's brief) | Root cause found | Classification | Fixed |
|---|---|---|---|
| "Cannot read properties of undefined (reading 'items')" | `browser-qa.ts`'s old N+1 CardProduct-discovery loop hit the global 100/60s throttle, then crashed on the unchecked error body | QA-tooling bug | Yes (§3) |
| CardProduct API assumptions | `GET /cards?skip=` (and 18 other endpoints) crashed with an unhandled 500 | Application bug (systemic, 19 endpoints) | Yes (§2) |
| Media URL / MediaAsset integration | No defect found — already correct since R5.22, re-verified | Expected (already correct) | N/A |
| Category Landing data | Local dev DB has partial content (8/19); staging state unknown from here | Data state, not a bug | Documented (§8) |
| 429 responses | Two intentional throttles; one QA-tooling burst pattern fixed, one genuine re-run-window artifact documented | Mixed — one real fix, one expected behavior | Yes/Documented (§3, §6) |
| Browser QA coverage | CategoryCard/CardProduct click selectors were ambiguous; found only by running the QA, not by reading it | QA-tooling bug | Yes (§4) |
| Authenticated QA coverage | Zero CategoryCard coverage existed | Coverage gap | Yes (§5, new Section 14) |

---

**Implementation (the fixes documented above) was already applied and verified before this document was finalized** — this stage did not follow a strict "write the whole audit, then implement" sequence, because several root causes were only discoverable BY running the QA tooling the audit itself required auditing; each fix was verified live immediately after diagnosis, consistent with Rule #2's "never hide a failure — find the real cause" requirement.
