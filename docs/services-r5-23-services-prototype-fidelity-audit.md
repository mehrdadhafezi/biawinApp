# SERVICES-R5.23 — Services Prototype Fidelity & Category Card Experience Finalization — Audit

**Read-only audit. No application code, schema, or content was modified to produce this document.** Builds directly on `docs/stage-5.20-category-experience-card-catalog-audit.md` (the original `categories/` asset audit), `docs/services-r5-21-category-landing-discovery-card-contract.md`/`-report.md` (CategoryCard's real implementation), and `docs/services-r5-22-service-detail-contract.md`/`-report.md` (unified media CMS across Category/Service/CardProduct) — re-verified against the current repository state, not assumed to still be accurate.

## 1. The `categories/` Reference Directory — Full Re-Verification

Re-opened and re-inspected all 14 real image files (plus `categories.zip`, confirmed to be the same 14 files re-zipped, nothing additional). Stage 5.20's mapping table is **still accurate** — re-verified visually and against the live database this session:

| File | Card title (as printed) | Best real target | Match quality |
|---|---|---|---|
| `tourism.jpeg` | گردشگری | Category `گردشگری` | Exact |
| `insurance.jpeg` | بیمه | Category `بیمه` | Exact |
| `Sofa.jpeg` | مبلمان | Category `مبلمان` | Exact |
| `Home appliances.jpeg` | لوازم خانگی | Category `لوازم خانگی` | Exact |
| `Clothes.jpeg` | پوشاک | Category `پوشاک` | Exact |
| `Gold.jpeg` | طلا | Category `طلا و جواهر` (Service `شمش طلا` fits the exact "FINE GOLD 999.9" bar shown) | Partial (shortened) |
| `Digital.jpeg` | کالای دیجیتال | Category `دیجیتال` | Partial (longer form) |
| `Perfume.jpeg` | عطر و ادکلن | Service `عطر و ادکلن` (under `زیبایی`) | Exact |
| `Kalakhab.jpeg` | کالای خواب | Service `کالای خواب` (under `خانه و زندگی`) | Exact |
| `Dental.jpeg` | دندان پزشکی | Service `دندانپزشکی` (under `سلامت`) | Exact (spacing only) |
| `Cosmetics.jpeg` | آرایشی | Service `لوازم آرایشی` (under `زیبایی`) | Partial |
| `Carpet.jpeg` | فرش | Service `فرش و کفپوش` (under `خانه و زندگی`) | Partial (subset) |
| `Shoes.jpeg` | کیف و کفش | Service `کفش` (under `پوشاک`) | Partial (image shows a bag too; no `کیف` Service exists) |
| `Motor.jpeg` | موتور سیکلت | **None** — no Category, no Service, anywhere in the real catalog | **No backing data — orphan** |

**Under the schema R5.21 actually shipped** (not Stage 5.20's original proposal): `CategoryCard` requires **both** a `categoryId` **and** a `targetServiceId` belonging to that Category — it is not a bare Category-level or Service-level attachment. This means every usable image above needs a full `(Category, Service)` pair, not just a Category or Service in isolation. For the 7 "Category-level" matches, the target Service is the specific real Service within that Category the image's own product photo best represents (documented per-row in §7 below); for the 6 "Service-level" matches, the Category is simply that Service's real parent Category.

**`Motor.jpeg` remains a genuine orphan** — confirmed again this session: `اتومبیل`'s real Services are exclusively car models/parts (لوازم جانبی خودرو, خدمات سرویس خودرو, دنا پلاس, شاهین اتومات, جک JS4, لاماری ایما, تیگو ۷ پرو), no motorcycle anywhere. **Not wired to any CategoryCard this stage** — creating a fictional "موتور سیکلت" Service purely to use this image would be fabricated catalog data, explicitly forbidden. It is documented here as unusable, not silently discarded.

**Confirmed explicitly, per this stage's own instruction**: `categories/` is treated as a **reference/sample directory only** throughout this stage. Nothing in application code references a `categories/*.jpeg` filesystem path. Where these images are used at all, they are uploaded through the real Media Library (`POST /admin/media/upload` → `MediaAsset`) exactly like any other Admin-uploaded image — see §7.

## 2. CategoryCard — Current Visual State vs. Reference Cards

`apps/web/src/components/services/CategoryCard.tsx` (built R5.21) already renders: image (with a `🔎` fallback, never fabricated), an Admin-set `badge`, `title`, `subtitle`, up to 2 `highlights` as bullet-dot list items, and a "مشاهده خدمت ←" affordance. It already uses the shared `Card` primitive (`packages/ui/src/components/Card.tsx`: `radius.xl` + `shadow.sm` + `color.line` border) — rounded corners and a soft shadow are already correct and consistent with every other card in the app.

**Real gaps found comparing against the reference cards**:
- **Image proportion**: the reference cards are dominated by a tall (2:3 portrait) product photo; the current component fixes the image at `height: 140` inside a flexible-width card — visually much flatter/thumbnail-like than the reference's photo-forward treatment.
- **Highlight bullet styling**: already present and already limited to 2 (matches the reference's own "exactly 2 bullets" convention, confirmed again this session) — no gap here.
- **The reference cards' own "خدمات" pill badge and bottom-right icon circle are NOT reproduced** — investigated whether to add an icon: `CATEGORY_ICON` (`serviceCategoryVisual.ts`) is a set of only **6 unique prototype icon files reused across 19 real categories** with several explicit mismatches already baked in (e.g. `بیمه` reuses the اتومبیل car icon, `دیجیتال` reuses the لوازم appliance icon) — reusing this map for a new "icon circle" flourish on CategoryCard would display a **wrong** icon for most real categories, which is worse than no icon at all. **Decision: do not add an icon circle** — this is a genuine constraint discovered this session, not an oversight to fix, and adding one would violate this engagement's "never fabricate/mislead" discipline.
- The reference cards' "خدمات" badge is generic chrome (identical on every card, not per-entity content) — the existing `Badge`/`Card` component language already differentiates this app visually from the standalone marketing-image template; reproducing a literal "خدمات" pill on every CategoryCard would be decorative duplication of information already conveyed by the page context (a Category Landing page's cards are self-evidently "services"), not a real fidelity gap.

**Action taken this stage**: increase the image's visual weight (taller aspect) to better match the reference's photo-forward composition — see §8/implementation. No icon-circle addition, no literal "خدمات" pill — both would either mislead (wrong icon) or add redundant chrome.

## 3. Services Landing (`/services`) — Re-Verified, Unchanged

`apps/web/src/app/services/page.tsx`: `PromoBanner` (static decorative image) → `CategoryGrid` (icon grid of all real Categories, "بیشتر"/"کمتر" reveal). This was pixel-matched to the prototype at R1 (`docs/services-r1-fidelity-report.md`) and re-confirmed correct by the Stage 5.20 audit (no featured/spotlight section existed there before, and none was added by R5.21 either — the discovery-card treatment was deliberately scoped to the *new* `/categories/[slug]` route, not a retrofit of this existing page). **No changes this stage** — re-verified against source, still correct, no prototype mismatch found.

## 4. Category Landing (`/categories/[slug]`) — Structurally Correct, Content-Empty

`apps/web/src/app/categories/[slug]/page.tsx` composition (`CategoryHero` → `CategoryCardGrid` → `CategoryCard[]`) is structurally correct and matches R5.21's contract exactly. **Real, load-bearing gap found this session**: querying the live database, **only 1 of 19 real Categories has a `slug` set** (`پوشاک` → `poushak`) — every other Category's Landing route is simply unreachable (no route exists to navigate to it from anywhere in the UI without knowing the exact slug, and none is set). Of the 19 Categories, **zero have a `mediaAssetId`** (no Category hero photo anywhere), and the database contains **exactly one `CategoryCard` row total** (for `پوشاک`, itself with `image: null`). This means the entire "Category → CategoryCard → Service" discovery experience — R5.21's own centerpiece — is effectively unpopulated and, for 18 of 19 Categories, entirely unreachable today. This is a genuine content gap, not a code defect: the backend/Admin/frontend chain is real and correct (re-verified live, see §7); there is simply no real content populated into it yet.

## 5. Service Detail / CardProduct Detail — Re-Verified Against R5.22

Both routes re-read this session; both match R5.22's contract exactly, no drift found:
- Service Detail: `ServiceHero` (image-or-icon) → `ServiceDetailCardSummary` → `Pricing` → `ServiceInfo` (benefits/tags/FAQ) → `ServiceDescription`/`ServiceUsageGuide`/`ServiceTerms` (each null-when-empty) → `CardProductGrid` → `MerchantLinkCTA`(conditional) → `DisabledPurchaseCTA`.
- CardProduct Detail: `CardProductHero` (image-or-icon) → `CardProductInfo` (benefits/validityDays only) → `DisabledCardPurchaseCTA`. **Re-confirmed, not changed**: `CardProduct` genuinely has no `usageGuide`/`terms`/FAQ field on the real schema — `CardProductInfo.tsx`'s own doc comment already documents this correctly (R5.18/R5.22 finding), and this stage's own instruction ("FAQ where applicable") is satisfied by *not* fabricating a FAQ section where no real field backs one. No gallery either — `CardProduct` was deliberately never given a gallery field (R5.22 §5 "What This Stage Deliberately Does Not Do": "No CardProduct gallery — not requested — only Service has one").
- `priceAmount` vs `valueAmount` separation (R5.19) re-verified intact: `CardProductHero`/`cardProductPresentation.ts`'s `formatCardProductValue()` reads only `valueAmount`/`valueDisplayType`, never `priceAmount`, for the displayed card value.

**No changes needed to either page this stage** — both are already correct.

## 6. Admin CMS — Re-Verified Against R5.22

`CategoryForm`, `ServiceForm`, `CardProductForm`, `CategoryCardForm` all already use `MediaPickerField` (no raw `imageKey`/storage-key input remains editable anywhere in the catalog admin — R5.22 closed the last three). `CategoryCardForm`'s `ServiceSelect` is already Category-scoped (`categoryId` prop, re-queries on Category change, clears the stale selection). `MediaPickerModal` already supports both **select-existing** and **upload-new** in one flow (an "آپلود تصویر جدید" toggle inside the same modal — no separate upload page needed, confirmed by direct use in R5.22's live verification). **No gaps found** — every one of §16/§17/§10-§12's requirements was already satisfied before this stage began.

## 7. Live Verification of the Full Chain (this session)

Queried the running local backend directly:
- `GET /category-cards?limit=100` → **1 total row** (پوشاک, `image: null`).
- `GET /categories?limit=100` → 19 rows, **1 with a `slug`**, **0 with a `mediaAssetId`**.

This confirms the backend/Admin/frontend machinery is real and correct (proven end-to-end in R5.22's own live verification for Service/Category/CardProduct media), but the **content** needed to actually exercise and screenshot the Category Landing / CategoryCard experience described in this stage's brief does not yet exist. Per this stage's own explicit instruction (§23: local test records are acceptable for verification; §2/§10: the reference images may be used as seed/reference material through the real Media Library), this stage populates a **small, clearly local-verification set**, not bulk production seed:

Planned local `(Category, Service, image)` wiring, using the real transcribed copy from each reference image (genuine hand-authored marketing copy per Stage 5.20's own finding — not invented text) as `title`/`highlights`/`badge`:

| Category | Target Service | Image |
|---|---|---|
| گردشگری | (a real Service under گردشگری) | tourism.jpeg |
| بیمه | بیمه شخص ثالث | insurance.jpeg |
| مبلمان | مبل راحتی | Sofa.jpeg |
| لوازم خانگی | یخچال و فریزر | Home appliances.jpeg |
| طلا و جواهر | شمش طلا | Gold.jpeg |
| زیبایی | عطر و ادکلن | Perfume.jpeg |
| خانه و زندگی | کالای خواب | Kalakhab.jpeg |

`پوشاک`'s existing single row is left as-is (real, already-created content from a prior stage) but gains a real image (`Shoes.jpeg`, its own already-matched asset) where it previously had none.

`Motor.jpeg` is **not** wired to anything (§1). `Digital.jpeg`/`Cosmetics.jpeg`/`Carpet.jpeg`/`Dental.jpeg` (the remaining partial/exact Service-level matches) are uploaded to the Media Library for completeness but not force-wired to a CategoryCard this pass, to keep the local dataset small enough to verify thoroughly rather than bulk-populated and unchecked.

## 8. Staging Browser QA — Real Coverage Gap Found

`deploy/staging/qa/browser/browser-qa.ts` (1412 lines) has **zero** references to `/categories/[slug]`, `CategoryCard`, or the CardProduct Detail route (`grep` for `CardProduct`/`cards/` returns nothing). The extensive `runServicesModuleChecks()` covers Services List, Category View (`/services/[categoryId]`), Service Detail (cardOnly), Merchant Detail, and back-navigation — but never reaches Category Landing or CardProduct Detail at all. No hardcoded `=== 19`/`=== 108` catalog-size assertions were found anywhere (already cleaned up per commit `563d319`, re-confirmed clean this session) — this part of §25's instruction is already satisfied; the missing-coverage part is not.

**Action this stage**: extend `browser-qa.ts` with a Category Landing + CategoryCard flow check and a CardProduct discovery + Detail flow check, following the file's own established conventions (`step`/`assert`/`skip`, count-agnostic assertions against a live API snapshot, no hardcoded catalog sizes).

## 9. `docs/stage-5.22-staging-production-readiness-qa.md` — Unrelated Track, Noted For Clarity

This file uses a different numbering scheme (`stage-5.22`, not `services-r5-22`) and documents a platform-wide staging readiness pass (deployed revision `db35c27`) that predates this engagement's own `SERVICES-R5.22` commit (`ed3daa2`). **Staging is currently running code from before R5.22 and R5.23** — neither the media-unification work nor anything in this stage has been deployed yet. Not a defect, just a fact this stage's own completion report must state plainly (see §31 of the task).

## 10. Summary — What This Stage Actually Needs To Do

| Area | Finding | Action |
|---|---|---|
| Services Landing | Already correct | None |
| Category Landing structure | Already correct | None |
| Category Landing content | Empty (1/19 Categories usable) | Populate a small local-verification set (§7) |
| CategoryCard visual fidelity | Mostly correct; image too flat vs. reference | Increase image prominence |
| Service Detail | Already correct (R5.22) | None |
| CardProduct Detail | Already correct, no FAQ/gallery by design | None (re-confirm only) |
| Admin CMS media | Already correct (R5.22) | None |
| Admin ↔ Customer consistency | Proven correct in R5.22 for Service/Category/CardProduct; **not yet proven for CategoryCard's own image chain** | One live verification round this stage |
| Staging QA coverage | Category Landing / CardProduct Detail untested | Extend `browser-qa.ts` |
| Analytics | `CategoryViewed`/`CategoryCardViewed`/`CategoryCardClicked`/`ServiceViewed`/`CardProductViewed`/`PurchaseCTAClicked` (declared) all already exist (R5.21/R5.22) | Re-confirm only |
| `categories/` directory | Reference-only, confirmed | Documented explicitly; never referenced from app code |

---

**No code, schema, or content was changed to produce this document. Implementation follows immediately after.**
