# SERVICES-R5.26.1 — Default Catalog & Reference Asset Migration — Final Report

Full pre-implementation audit: [`docs/services-r5-26-1-default-catalog-audit.md`](./services-r5-26-1-default-catalog-audit.md). This report covers what was actually done, verified, and found.

## 1. Reference Asset Migration

**Permanent location: `docs/prototypes/services/categories/`** — no existing `docs/` subdirectory convention for reference assets was found (the repository's own actual prototype HTML was never committed, only analysis docs about it — see the audit §2/§9), so this stage used the task's own suggested default.

- All 14 unique reference JPEGs moved from the root `categories/` directory to the permanent location, original filenames preserved.
- `categories.zip` (a pure duplicate bundle of the same 14 files — confirmed via `unzip -l`, zero unique content) was dropped rather than moved.
- The root `categories/` directory no longer exists.
- Nothing in runtime code (`apps/web`, `apps/admin`, `backend`) references this directory or these filenames — every image that reaches the customer/admin UI does so exclusively through a real `MediaAsset` row and its resolved `/api/v1/media/:key` URL.

## 2. Image → Catalog Mapping (final)

Every one of the 14 images was opened and visually inspected (not guessed from filename) — see the audit §2 for the full table, including the one filename/content mismatch found (`Shoes.jpeg` actually depicts "کیف و کفش", bags and shoes together).

| Image | Outcome |
|---|---|
| Gold, Home appliances, Kalakhab, Perfume, Shoes, Sofa, insurance, tourism | Already fully wired before this stage began (real prior progress in this environment — see audit §3); re-verified intact, untouched. |
| Carpet, Clothes, Cosmetics, Dental, Digital | New CategoryCards created this stage (Dental/Digital also required populating their Category's `slug`/hero `mediaAssetId`, which had never been set). |
| **Motor** | **Left unresolved — no real Category/Service exists for "موتور سیکلت", and the one plausible Category (`اتومبیل`) is explicitly car-model-only by its own real data. Not forced, not fabricated. Stays in the reference directory only. See audit §5.** |

## 3. What Was Created This Stage

**Categories populated** (slug + hero `mediaAssetId` set — only where both were previously null; nothing already set by Admin was touched): **2** — `سلامت` (slug `salamat`), `دیجیتال` (slug `dijital`). `اتومبیل` deliberately left alone (no reference image maps to it).

**CategoryCards created**: **5** — `فرش` (→ `خانه و زندگی` / `فرش و کفپوش`), `پوشاک` (→ `پوشاک` / `خرید پوشاک`), `آرایشی` (→ `زیبایی` / `لوازم آرایشی`), `دندان پزشکی` (→ `سلامت` / `دندانپزشکی`), `کالای دیجیتال` (→ `دیجیتال` / `گوشی موبایل`). Two of these (`فرش`, `پوشاک`, `آرایشی` — three, not two) land as a genuine **second** discovery card under a Category that already had one, matching what the reference mockups clearly intended (two distinct cards per Category in those three cases).

**Services created**: **0** — every target Service already existed, seeded by the pre-existing `backend/prisma/seed.ts` (confirmed in the audit; this stage never creates a Category or Service, only populates/links what already exists).

**CardProducts created**: **4**, all real, `ACTIVE`, `journeyType: PURCHASE`, correctly-owned, correctly priced, with a resolved image:

| Title | Service | Payable price (Rial) | Card value (Rial) |
|---|---|---|---|
| کارت خرید کفش ۲۰ میلیونی | کفش (پوشاک) | 10,000,000 | 20,000,000 |
| کارت اعتباری خرید شمش طلا | شمش طلا (طلا و جواهر) | 25,000,000 | 50,000,000 |
| کارت اعتباری تور کیش | تور کیش (گردشگری) | 5,000,000 | 15,000,000 |
| کارت اعتباری خرید لوازم خانگی | یخچال و فریزر (لوازم خانگی) | 8,000,000 | 25,000,000 |

Plus the one pre-existing `ACTIVE`/`PURCHASE`/priced `CardProduct` from earlier R5.19/R5.26 QA work (mis-owned — title about insurance, `serviceId` points to baby products — see audit §8), left untouched deliberately: not this stage's data, no instruction to alter pre-existing unrelated rows, and R5.26's QA discovers CardProducts dynamically so nothing depends on it being "fixed."

**MediaAssets created/reused**: **0 newly uploaded by this stage's script** — all 9 distinct reference files the script needed (`Dental.jpeg`, `Digital.jpeg`, `Carpet.jpeg`, `Clothes.jpeg`, `Cosmetics.jpeg`, `Shoes.jpeg`, `Gold.jpeg`, `tourism.jpeg`, `Home appliances.jpeg`) were already present as real `MediaAsset` rows from the environment's pre-existing state; the idempotent `findOrUploadMedia()` helper correctly detected and reused every one (verified — see §5). The script is fully capable of uploading via the real `MediaService.upload()` (same architecture as `seed-home-media.ts`) on an environment where they don't yet exist (e.g. a clean staging database), which is the scenario it was actually written for.

**Real ACTIVE/PURCHASE CardProducts now discoverable**: **5** total (4 new + 1 pre-existing) — R5.26/R5.27 QA and the real customer flow now have several genuine options across different Categories, not just one.

## 4. Idempotency — Verified, Not Assumed

The new script, `backend/prisma/seed-default-catalog.ts` (run via `pnpm --filter @biawin/backend seed:default-catalog`), was run **three times** against the real local database during this stage:

1. First run: created everything listed in §3 (media reused, Categories populated, CategoryCards created, CardProducts created without images — a gap found immediately after).
2. Second run, after fixing the CardProduct-image gap: `[skip, already populated]` / `[skip, already exists]` for every Category/CategoryCard, `[backfilled image]` for the 4 CardProducts (idempotent backfill-if-missing, not a duplicate).
3. Third run: `[skip, already exists]` for every single row, including the CardProduct images now — **zero writes**, confirmed by the script's own log output.

A full data-integrity scan (duplicate slugs, cross-category CategoryCard ownership, ACTIVE+PURCHASE CardProducts missing price/value, broken MediaAsset references, inactive-parent-with-active-child, orphan CardProducts) was run directly against the database after all seeding: **0 issues found** — see §8.

## 5. Media Library Compliance

No raw storage key was ever written to `imageKey`/a filesystem path by this stage's code. Confirmed two ways:

- The seed script goes through the real `MediaService.upload()` via a bootstrapped Nest application context — the exact same architecture `seed-home-media.ts` already established (never reimplements storage/validation logic).
- Admin CMS source was (re-)read, not assumed: `CategoryForm.tsx`, `CategoryCardForm.tsx`, `ServiceForm.tsx`, `CardProductForm.tsx` all use the shared `MediaPickerField` component and write only `mediaAssetId` — no raw-key input exists anywhere in the catalog Admin forms. **No Admin CMS code changes were needed or made.**
- Every new image was spot-verified to resolve as real HTTP 200 bytes through the public media route (`curl` against `/api/v1/media/:key` for Dental/Digital/Carpet — all `200`), and the new authenticated-QA section (§7) asserts this for whatever real Category/CategoryCard/CardProduct it dynamically discovers.

## 6. Admin CMS Verification

Confirmed both by reading source (no changes needed — §5) and live in the browser:

- `CategoryCardForm.tsx`'s `targetServiceId` field uses a Category-scoped `ServiceSelect` — only Services under the currently-selected Category are ever offered (confirmed in its own doc comment and source); server-side ownership (`CategoryCardsService.assertOwnership`) is the real, independent boundary regardless.
- New browser-QA coverage (`deploy/staging/qa/browser/browser-qa.ts`, `adminCatalogChecks()`) — previously **zero** browser-level coverage existed for any of the four `/catalog/*` Admin pages; now all four (Categories, CategoryCards, Services, CardProducts) are confirmed to render with no broken images and are screenshotted, run live against the local Admin app: all 4 checks **PASS**.
- The existing `categoryCardOwnershipAndCrudCheck` (API-layer, R5.24) already proves the full Admin-edit → public-API-reflects-change loop for CategoryCard specifically (create → edit → appears in public list → deactivate → disappears from public list) — re-confirmed still passing this stage, not duplicated.

## 7. Customer Browser Verification (live, local)

Performed directly in the browser (STAGING_TEST_AUTH OTP-verify bypass, same technique used throughout R5.19–R5.26):

- **`/categories/salamat`** (سلامت — newly populated this stage): real hero (name + description), 1 real service count, the new "دندان پزشکی" CategoryCard rendered with its 2 highlights and a working "مشاهده خدمت ←" link. All 3 `<img>` elements on the page loaded (`complete: true`, real `naturalWidth`) — no broken images.
- **`/categories/dijital`** (دیجیتال — newly populated this stage): same, with the new "کالای دیجیتال" CategoryCard.
- **`/categories/poushak`** (پوشاک — already-populated Category, now with a genuine 2nd card): both "کیف و کفش" (pre-existing) and "پوشاک" (new) CategoryCards render side by side, each with its own image, title, highlights.
- **Full purchase-chain click-through** for a brand-new default CardProduct: پوشاک → کیف و کفش card → کفش Service → "کارت خرید کفش ۲۰ میلیونی" CardProduct Detail → real, **enabled** ("`disabled: false`", confirmed via direct DOM check) "خرید کارت" CTA, with price (۱,۰۰۰,۰۰۰ تومان) and card value (۲,۰۰۰,۰۰۰ تومان) shown separately and correctly (`priceAmount`/`valueAmount` stored in Rial, `formatToman` renders in Toman — the established R5.19/R5.25 convention, not a display bug).

## 8. Authenticated QA (local, real Postgres/Redis/backend)

Clean run (before repeated re-runs in the same session hit the real 5-attempts/10-minutes admin-login throttle — a self-inflicted rate-limit artifact from testing, not a defect; documented honestly rather than hidden):

```
Totals: 100 PASS, 0 FAIL, 2 NOT_TESTED
Cleanup: OK — staging restored to its approved state
```

New `SERVICES-R5.26.1` section (`servicesR5261DefaultCatalogCheck()`), entirely dynamic — no hardcoded id/count:

- `discover a real Category with a real slug` → found "مبلمان" (whichever exists first; genuinely dynamic).
- `discover real CategoryCards for "مبلمان"` → found.
- `CategoryCard "مبلمان" image resolves and target Service belongs to "مبلمان"` → real `fetch()` against the image URL asserted `.ok`; target Service's `categoryId` asserted to match.
- `discover a real ACTIVE/PURCHASE CardProduct with both price and value set` → found.
- `CardProduct priceAmount/valueAmount are independently positive and its image resolves` → all asserted, including a real image fetch.

Also closed one incidental gap found while extending this file: the existing 1-of-19-categories-had-a-slug fixture the R5.19 section discovers now (because of this stage's own population work) more often resolves to a real record instead of NOT_TESTED — improving, not degrading, existing coverage.

The 2 NOT_TESTED are pre-existing, honest, real-data gaps unrelated to this stage (no non-ACTIVE CardProduct exists to discover; no Service has authoritative Service-path pricing) — both already covered at the unit-test level, both already NOT_TESTED before this stage too.

## 9. Browser QA (local, real dev servers)

Two dimensions extended, both run live:

- **Admin catalog** (`adminCatalogChecks()`, new): Categories/CategoryCards/Services/CardProducts admin list pages — all render with no broken images, all screenshotted (`admin-catalog-categories`, `admin-catalog-category-cards`, `admin-catalog-services`, `admin-catalog-card-products`). **4/4 PASS**, run against a real local Admin dev server (`pnpm --filter @biawin/admin dev`, port 3002).
- **Customer catalog flow** (existing `runCategoryLandingAndCardProductChecks`, dynamic — picks up whatever real Category/CardProduct data exists, now includes this stage's new rows automatically with zero code change needed there): re-run clean, all catalog-related steps **PASS**. Two unrelated FAILs appeared during repeated re-runs in this same session (`__nextjs_font/geist-latin.woff2` dev-mode font-abort noise; the real OTP-request throttle from re-running the full customer login flow too many times back to back) — both are session-testing artifacts, not defects, and neither touches this stage's own catalog code.

## 10. Data Integrity — Final Check

Direct database scan, after all seeding:

| Check | Result |
|---|---|
| Duplicate Category slugs | 0 |
| CategoryCards whose targetService belongs to a different Category | 0 |
| Active CategoryCards with no media | 0 |
| ACTIVE + PURCHASE CardProducts missing price or value | 0 |
| Broken MediaAsset references (Category/CategoryCard/CardProduct) | 0 |
| Inactive Category with an active child CategoryCard | 0 (0 inactive Categories exist) |
| Orphan CardProducts (no real Service) | 0 |

**Zero issues.**

## 11. Quality Gates

All run locally, all clean:

- `prisma validate` ✅ (no schema change this stage — confirmed unnecessary).
- Workspace-wide `turbo run typecheck lint test build`: **18/18 tasks successful** (backend, web, admin, `packages/ui`).
- Backend typecheck explicitly re-confirmed clean after the QA-runner edits (`tsc --noEmit`, 0 errors).
- `browser-qa.ts`'s own isolated `tsc --noEmit` (separate `node_modules`/tsconfig from the rest of the workspace) — clean.

## 12. Staging Deployment

`/srv/biawin-staging` does not exist in this environment (`ls /srv` → "No such file or directory"; `cd /srv/biawin-staging` fails) — confirmed again this stage, consistent with every prior stage (R5.22–R5.26). Staging deploy, staging authenticated QA, and staging browser QA were **not executed** — no reachable staging environment exists from this development environment. All QA evidence above is real, but local, not staging — reported honestly, not claimed as staging-verified.

## 13. Unresolved Reference Assets

**`Motor.jpeg`** (موتور سیکلت) — no real Category or Service exists for it; the one plausible home (`اتومبیل`) is car-model-only by its own real seeded data (Tiggo 7 Pro, Dena Plus, Shahin Automatic, etc. — no motorcycle concept). Left in `docs/prototypes/services/categories/`, not injected into any table. See the audit's §5 for the full reasoning, including the independent corroboration that whoever populated the other 8 Categories before this stage reached the identical conclusion (it's the only one of the 14 images never even uploaded as a MediaAsset).

## 14. Payment / Gateway

**Not implemented.** No `PaymentService`, `GatewayProvider`, `WalletService.debit`, `CreditService`, or `InstallmentService` code was touched or added. This stage's CardProducts reach exactly the same "ready for payment" `pending` Order state R5.26 already established — R5.27 remains the next, separate stage.

## 15. Commit

Commit: `2535e56141abfb3f123e62283fedb131f60848f5` — "feat(services): SERVICES-R5.26.1 seed default catalog content", 20 files changed, 758 insertions(+).
Branch: `main`, pushed (`0971dde..2535e56`).

Final clean confirmation runs (after the admin-login rate-limit window — self-inflicted by repeated testing in this same session — cleared):
- Authenticated API QA: **100 PASS, 0 FAIL, 2 NOT_TESTED**.
- Browser QA (Admin + Customer): **99 PASS, 0 FAIL, 1 NOT_TESTED**.

Staging deploy/QA: attempted exactly as instructed (`cd /srv/biawin-staging && ./deploy/staging/deploy.sh`, then `./deploy/staging/run-authenticated-qa.sh`) — **NOT EXECUTED**, `/srv/biawin-staging` does not exist in this environment (confirmed via `ls /srv` → "No such file or directory"). Consistent with every prior stage (R5.22–R5.26).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
