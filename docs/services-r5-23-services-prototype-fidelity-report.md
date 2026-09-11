# SERVICES-R5.23 — Services Prototype Fidelity & Category Card Experience Finalization — Report

Contract/audit: [docs/services-r5-23-services-prototype-fidelity-audit.md](./services-r5-23-services-prototype-fidelity-audit.md). This report describes what was actually built and verified, against that audit's findings.

## 1. Prototype Findings

Services Landing, Category View, Service Detail, and CardProduct Detail were all re-verified against the original approved prototype and against R5.16–R5.22's own already-settled fidelity work — **all four already matched and needed no changes** (audit §3/§5). The only genuine visual-fidelity gap found was `CategoryCard`'s image treatment, compared against the product-owner-provided reference card mockups in `categories/` (audit §2).

## 2. Current-State Findings

The Category → CategoryCard → Service → CardProduct backend/Admin/frontend machinery was already fully correct (built R5.21/R5.22) but almost entirely **empty of content**: only 1 of 19 real Categories had a `slug` (making its Landing route reachable at all), 0 Categories had a hero image, and the database held exactly 1 `CategoryCard` row total (audit §4/§7). The code was real; the content to actually exercise and verify it was not.

## 3. CategoryCard Architecture — Unchanged, Visually Refined

The `Category → CategoryCard → Service` domain model (R5.21) was re-confirmed correct and untouched this stage — no schema change, no new field, no collapse of `CategoryCard` and `CardProduct`. The only change is presentational: `CategoryCard.tsx`'s image now renders at `aspect-ratio: 3 / 4` (previously a flat fixed `height: 140`), matching the reference cards' photo-forward composition. Deliberately **not** added: a "خدمات" pill badge (redundant chrome — the page context already establishes these are service cards) and an icon-circle badge (the only real icon set in this app, `CATEGORY_ICON`, reuses 6 icons across 19 categories with several explicit mismatches already baked in — e.g. `بیمه` reuses the اتومبیل car icon — adding it to CategoryCard would show a wrong icon for most real cards, which is worse than none). Both decisions are documented in the component's own doc comment.

## 4. Media Architecture

No changes — R5.22 already put `Category`, `Service`, and `CardProduct` on the same `mediaAssetId → MediaAsset → MediaStorageService.resolvePublicUrl()` pipeline as `CategoryCard` (R5.21) and Home CMS. This stage's only architectural confirmation: **`categories/` is a reference/sample directory only.** No application code (backend, Admin, or Web) reads a `categories/*.jpeg` path at runtime — verified by grep across the whole repository, zero matches outside this directory's own presence on disk. Every image actually rendered anywhere in this stage's work was uploaded through the real `POST /admin/media/upload` endpoint into a genuine `MediaAsset` row, then attached via `mediaAssetId`, exactly like any other Admin-uploaded image.

## 5. Admin Architecture

No code changes — re-verified `CategoryForm`, `ServiceForm`, `CardProductForm`, `CategoryCardForm` (all already `MediaPickerField`-based since R5.22/R5.21) and `CategoryCardForm`'s Category-scoped `ServiceSelect` (already correct since R5.21). No raw storage-key input exists anywhere in the catalog Admin CMS today.

## 6. Customer UI Changes

- `CategoryCard.tsx` (`apps/web/src/components/services/CategoryCard.tsx`): image now `aspect-ratio: 3 / 4` instead of a fixed `height: 140`.
- No other customer-facing code changed — Services Landing, Category Landing composition, Service Detail, and CardProduct Detail were all re-verified already correct (audit §3/§5).

## 7. Content Populated (Local Verification Only — Not Production Seed)

Per this stage's own explicit rule (§23: local test records for verification are acceptable; not committed as production seed), and using the reference images strictly as content/copy material through the real Media Library (never as filesystem paths), the following was populated directly against the local dev database via the real Admin API (same `POST`/`PUT` endpoints the Admin UI itself calls):

- **13 of the 14 reference images** uploaded as real `MediaAsset` rows (`POST /admin/media/upload`). **`Motor.jpeg` was deliberately excluded** — it matches no real Category or Service anywhere in the catalog (re-confirmed this session), and wiring it to anything would mean fabricating a "موتور سیکلت" Service that doesn't exist. It remains unused, documented as unusable rather than silently discarded.
- **8 Categories** now have a real `mediaAssetId` (hero photo) and `slug` (Landing route reachable): گردشگری, بیمه, مبلمان, لوازم خانگی, طلا و جواهر, زیبایی, خانه و زندگی, and پوشاک (already had a slug from a prior stage; gained its hero image this stage).
- **8 real `CategoryCard` rows** exist (7 created this stage + 1 pre-existing, now also given its matched image), each using the genuine hand-authored title/highlight copy transcribed directly from its reference image (per Stage 5.20's own finding: this copy is real, subject-specific marketing text, not a template — transcribing it is not fabrication).
- **4 additional images** (Digital.jpeg, Cosmetics.jpeg, Carpet.jpeg, Dental.jpeg) uploaded to the Media Library for completeness but not force-wired to a `CategoryCard` this pass, keeping the verified dataset small and fully checked rather than bulk-populated and unverified.

This is local dev-database content, not a seed script and not committed to the repository — a product owner reviewing real content decisions may keep, edit, or replace any of it through the same Admin UI.

## 8. Analytics

Re-verified, not changed: `CategoryViewed`, `CategoryCardViewed`, `CategoryCardClicked`, `ServiceViewed`, `CardProductViewed` all fire from their real R5.21/R5.22 call sites; `PurchaseCTAClicked` remains declared-only (no real enabled purchase button exists to fire it from, honestly documented in `analytics.ts`'s own comment since R5.22 — unchanged this stage).

## 9. Tests

- **Web**: added a `CategoryCard.test.tsx` case asserting the new `aspect-ratio: 3 / 4` image styling and the absence of the old fixed height. Full web suite: **139 passing** (was 138 before this stage).
- **Backend/Admin**: no code changed this stage; full suites re-run to confirm no regression — **245** (backend) and **84** (admin) passing, unchanged counts.
- **Staging browser QA** (`deploy/staging/qa/browser/browser-qa.ts`): added `runCategoryLandingAndCardProductChecks()` — a new, count-agnostic check covering Category Landing hero rendering, CategoryCard grid rendering (including the correct empty-state copy when a Category has a Landing route but no cards), CategoryCard → Service click-through with ownership verification, a "never a raw `categories/` path in rendered HTML" assertion, and a full CardProduct discovery → Detail flow (hero, disabled purchase CTA, no broken images). Wired into the existing authenticated customer flow (`runCustomerChecks`), right after `runServicesModuleChecks`. Typechecks clean against the script's own isolated `tsconfig.json`.

## 10. QA

`browser-qa.ts` was re-confirmed to already have zero hardcoded catalog-size assertions (`=== 19`/`=== 108`) anywhere — that cleanup was already done in commit `563d319`, before this stage. The real gap closed this stage was **missing coverage**, not incorrect assertions (see §9).

**Live local verification performed this session** (backend + Postgres + Redis + web, all running locally): logged in as a real customer (OTP), navigated to multiple newly-populated Category Landing pages (`/categories/gardeshgari`, `/categories/zibaei`, `/categories/tala-javaher`), confirmed in each case: the real full-bleed Category hero photo loads, the real `CategoryCard` renders with its real title/highlights/image at the new taller aspect ratio, clicking a card navigates to exactly the correct `/services/{categoryId}/{targetServiceId}` URL, and mobile viewport (375px) shows no horizontal overflow with correct RTL layout throughout. This is the same "Upload → Select → Save → Re-fetch → Customer rendering" chain this stage's own instructions required to be actually tested, not assumed from the field rendering.

**One real defect found and fixed during this verification**: the first attempt at populating `CategoryCard` content via direct API calls (bash → node → curl) corrupted the Persian text encoding (mojibake) for all 7 new rows. This was caught by the live browser check (§ above), not assumed correct from the API response alone, and fixed with a proper UTF-8-safe Node script before re-verifying.

## 11. Remaining Blockers / Known Gaps

- **Only 8 of 19 Categories have real Landing content.** The other 11 have no slug, no hero image, and no CategoryCard — correctly unreachable/empty rather than showing fabricated content, but a real content gap a product owner should close over time through the Admin UI this stage finalized.
- **`Motor.jpeg` remains genuinely unusable** — no Category or Service exists for it. Resolving this requires a real catalog-content decision (add a Service, add a Category, or discard the asset), not a technical fix.
- **No lightbox/gallery UI exists for `Service.gallery`** — unchanged limitation from R5.22, still correctly not fabricated.
- **Staging was not redeployed or re-QA'd this session** — see §12.

## 12. Staging Deployment — Not Executed From This Environment

`/srv/biawin-staging` (the path the deploy convention names) **does not exist on this machine** — confirmed directly (`ls /srv` fails: no such directory). This environment has no SSH/network path to the staging host. Per this stage's own explicit instruction, **this is reported honestly rather than pretended**: staging was **not** deployed and staging QA was **not** run as part of this session. `docs/stage-5.22-staging-production-readiness-qa.md` (an unrelated numbering track) confirms staging currently runs commit `db35c27`, which predates both `SERVICES-R5.22` (`ed3daa2`) and this stage's own commit — **staging is running code from before the media-unification work and everything in this report.**

**To actually deploy and QA this work**, run from a machine with access to the staging host:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
cd /srv/biawin-staging && ./deploy/staging/run-authenticated-qa.sh
```

The second command will now also exercise the new Category Landing/CategoryCard/CardProduct Detail checks added in §9/§10.

---

## Explicit Confirmations (per this stage's own required checklist)

1. **`categories/` was treated only as a reference/sample directory** — inspected, mapped, and used exclusively as source *content* (image bytes + transcribed copy) uploaded through the real Media Library; never referenced as a filesystem path from any application code.
2. **Production images are managed through `MediaAsset` / Media Library** — every image rendered anywhere in this stage's verification resolves through `MediaStorageService.resolvePublicUrl()`, never a raw key or `categories/` path.
3. **Content Editors no longer need to enter raw storage keys** — re-confirmed across all four catalog forms (`Category`, `Service`, `CardProduct`, `CategoryCard`); none have exposed a raw `imageKey`/storage-path input since R5.22.
4. **`Category → CategoryCard → Service → CardProduct` is the final catalog/discovery chain** — re-confirmed structurally correct and unchanged this stage; `CategoryCard` still carries no price, no `CardProduct` reference, and no purchase state.
5. **Payment was intentionally NOT implemented in this stage** — no `Order`/gateway/wallet/installment-execution/refund/settlement/merchant-portal code was touched; `DisabledPurchaseCTA`/`DisabledCardPurchaseCTA` remain the only purchase-adjacent UI, both still genuinely `disabled`.
