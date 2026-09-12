# SERVICES-R5.26.2 — Default Catalog Seed + Empty-State QA Finalization — Report

Local work is complete and fully green. Staging deploy/QA could not be executed — see §7. Not declared "COMPLETE" per this stage's own explicit instruction not to claim completion when any required step can't be verified.

## 1. Root Cause (confirmed by audit, not assumed)

Two independent bugs, both found by reading source before writing any code:

1. **The official deploy pipeline never ran `seed-default-catalog.ts`.** `backend/package.json`'s `prisma:seed` and `prisma.config.ts`'s `migrations.seed` both point only at `prisma/seed.ts`. `deploy/staging/deploy.sh` explicitly runs exactly two seed-shaped commands (`SEED_CMD` → `dist/prisma/seed.js`, `MEDIA_MIGRATION_CMD` → `dist/prisma/seed-home-media.js`) — R5.26.1's `seed-default-catalog.ts` was a third script nobody ever called in any real deploy. It only ever ran because it was invoked by hand, locally, during R5.26.1's own session.
2. **`browser-qa.ts`'s admin catalog checks called `page.waitForSelector('table', ...)` unconditionally.** Both `CatalogListTable.tsx` and `ResourceListPage.tsx` (confirmed by reading their source) render no `<table>` at all when a list is genuinely empty — just the real `<p>{emptyLabel}</p>` — a valid state, not a defect. Before fix #1 landed anywhere, a fresh/staging CardProducts list was genuinely empty, and this line reported that legitimate state as a FAIL.

## 2. Fixes

- **`deploy/staging/deploy.sh`**: added `DEFAULT_CATALOG_CMD='cd backend && node dist/prisma/seed-default-catalog.js'`, run as step 6/8 (after `SEED_CMD`, which creates the Category/Service rows and `SUPER_ADMIN` account this script needs; before the app containers are cut over). Renumbered 7→8 steps.
- **`deploy/staging/verify-runtime-image.sh`**: sources, runs, and verifies `DEFAULT_CATALOG_CMD` too (6 steps, was 5) — keeps the "verify the exact same commands deploy.sh runs, never a hand-copied duplicate" guarantee this script exists for.
- **`deploy/staging/qa/browser/browser-qa.ts`**:
  - Categories/CategoryCards/Services checks now race the real `<table>` against the real, exact `emptyLabel` text and accept either as a valid PASS.
  - CardProducts gets its own stronger check (`adminCardProductsCheck`): still handles a genuinely empty catalog as valid, but when populated, asserts **≥ 5 rows** (this stage's own acceptance bar) and opens the first row's edit page to confirm a real, Media-Library-resolved image (never a raw storage key) and the real price/value fields.
  - Found and fixed a second, related bug while verifying the above: the CardProduct edit page (`EditCardProductPage`) also shows only "در حال بارگذاری…" until its own client-side fetch resolves — the same loading-race class already fixed once for the Purchase result page (R5.26). Fixed by waiting for the real "مبلغ (ریال)" field label instead of `networkidle` alone.
  - Found and fixed a third, unrelated-but-real issue: the Home page's orbit-ring (`/api/v1/media/*.webp`) and membership-strip (`/home/membership/item-NN.webp`) images can be legitimately cancelled by an in-flight navigation during Home→Category smoke-testing — the exact same benign render-lifecycle class this file already narrowly handles for `/services/*.webp` and catalog fetches, just two URL patterns it didn't cover yet. Extended with a new, equally narrow `isBenignHomeImageCancelledByNavigation` rule (exact `net::ERR_ABORTED` + `resourceType=image` + one of these two exact path shapes + a real correlated navigation) — every one of the failing images independently verified via `curl` to return real HTTP 200 + `image/webp` first.
- **`backend/scripts/staging-qa/authenticated-qa-runner.ts`**: new `servicesR5262DefaultCatalogFinalizationCheck()` — asserts real Categories exist, every sloged Category's image resolves, every active CategoryCard's image resolves and its Service ownership is correct (not just one — every row), real Services exist with valid Category relations, and — this stage's explicit acceptance bar — **≥ 5 real ACTIVE/PURCHASE CardProducts exist**, each individually checked for positive price, positive value, a resolving image, and correct Service→Category ownership.
- **`backend/prisma/seed-default-catalog.ts`**: found one genuine data-integrity gap while verifying (§4) — a pre-existing R5.19/R5.26 QA-created CardProduct (`کارت اعتباری بیمه شخص ثالث`) was real/ACTIVE/PURCHASE/priced/valued but had no image. Added a small, generalized, idempotent backfill pass (title-keyword matched, not hardcoded to one row) that gives it `insurance.jpeg` — additive only, never touches title/service/price/value.

## 3. Idempotency — Verified, Not Assumed

`seed-default-catalog.ts` was run **four times** total across this stage (two before the backfill fix, two after):
- Runs 1–2 (pre-fix): identical output both times — every Category/CategoryCard/CardProduct already existed, `[skip, already exists]` throughout. Zero duplicates.
- Run 3 (post-fix, first time the backfill logic existed): `[backfilled image] کارت اعتباری بیمه شخص ثالث -> insurance.jpeg` — the one genuine gap, fixed.
- Run 4: `[skip, already exists]` for everything, including the backfill section (found nothing left to do). Zero writes.

## 4. Local Database Verification

```
categories: 19        (10 with a real slug)
categoryCardsActive: 13
services: 109
cardProducts: 5        (all 5 ACTIVE/PURCHASE/priceAmount>0/valueAmount>0)
mediaAssets: 58         (grew from 51 during this session's own QA-artifact uploads — screenshots/probes, not catalog data)
```

Full data-integrity scan after the backfill fix: duplicate slugs (0), CategoryCard cross-category ownership violations (0), CategoryCard missing media (0), ACTIVE/PURCHASE CardProduct missing price/value/media (0 — down from 1 before the fix), broken MediaAsset references anywhere (0). **Zero issues.**

## 5. Local QA

- **Authenticated API QA**: `108 PASS, 0 FAIL, 2 NOT_TESTED` (both NOT_TESTED pre-existing, unrelated, real content gaps — no Service has authoritative pricing; no non-ACTIVE CardProduct exists to discover). All 8 new R5.26.2 checks passed, including the exhaustive per-row CardProduct validation (`n=5`) and per-row CategoryCard validation (`n=13`).
- **Browser QA**: `101 PASS, 0 FAIL, 1 NOT_TESTED` (the one NOT_TESTED is the pre-existing, unrelated "no Service has a real merchantId" gap). Admin catalog: all four list pages PASS, CardProducts ≥5-row check PASS, real-image/price/value detail check PASS. Customer: full Category→CategoryCard→Service→CardProduct→Purchase-CTA chain PASS, including the real purchase-sheet-to-order flow.
- Directly verified in the browser (not just via the automated script): پوشاک → کیف و کفش → کفش → "کارت خرید کفش ۲۰ میلیونی" renders a real resolved image (`naturalWidth=1000`, `complete=true`, served from `/api/v1/media/*.jpg`), no raw storage key anywhere in the DOM, and a real, **enabled** "خرید کارت" CTA.
- Full workspace quality gates: `prisma validate` ✅; `turbo run typecheck lint test build` — **18/18 tasks successful** (backend 47/47 suites, 249/249 tests; web, admin, `packages/ui` all clean).

## 6. Git

Commit: `2c39015d2d7932ab41a1c77c9d8b4be21ed4f7a5` — "feat(services): finalize default catalog seed and QA", 5 files changed, 349 insertions(+), 27 deletions(-).
Pushed: `511139a..2c39015` on `main`.

## 7. Staging — NOT EXECUTED (real reason, not guessed)

Ran exactly the mandated sequence:

```
cd /srv/biawin-staging   # fails: No such file or directory
git fetch origin / git checkout main / git reset --hard origin/main / git rev-parse --short HEAD
./deploy/staging/deploy.sh
```

`/srv/biawin-staging` does not exist in this environment (`ls /srv` → "No such file or directory") — this sandbox is a local development environment, not the staging server, consistent with every prior stage of this entire engagement (R5.19 through R5.26.1, all independently confirmed the same). Because the `cd` failure didn't stop the script, the remaining commands ran against the **local repository checkout** instead (which is why `git rev-parse --short HEAD` printed `2c39015` — that's this local clone already being on the commit just pushed, not a staging verification). `deploy.sh` itself then correctly refused to proceed: `deploy/staging/.env.staging not found` — there are no real staging secrets in this environment either, which is the honest, expected outcome.

**Staging deploy: NOT EXECUTED.**
**Staging container health check: NOT EXECUTED** (no deploy to check).
**Staging authenticated QA: NOT EXECUTED** (`run-authenticated-qa.sh` targets the same nonexistent `/srv/biawin-staging`).
**Staging browser QA: NOT EXECUTED** (same reason).
**Staging screenshots: NOT TAKEN** (nothing to screenshot).

## 8. Payment/Gateway

Not touched. No `PaymentService`/`GatewayProvider`/`WalletService.debit`/`CreditService`/`InstallmentService` code was added or modified. `CustomerCardInstance`/`UsageTransaction`/Fulfillment/Redemption were not introduced. R5.27 was not started.

## 9. Status

Local implementation, local QA (API + browser), and full quality gates are **complete and fully green**. Staging deploy and staging QA are **NOT EXECUTED** — this environment has no reachable staging server, a hard, pre-existing constraint of this sandbox, not a defect introduced by this stage. This stage is therefore reported as **locally complete, staging-unverified** — not declared "SERVICES-R5.26.2 COMPLETE," per this stage's own explicit instruction not to claim completion when a required step cannot be run.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
