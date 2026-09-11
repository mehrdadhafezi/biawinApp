# SERVICES-R5.25 — Services Prototype Finalization — Report

Audit: [docs/services-r5-25-services-prototype-finalization-audit.md](./services-r5-25-services-prototype-finalization-audit.md).

## 1. Audit Findings

Full findings in the audit doc. Services Landing, Category Landing, CategoryCard, Service Detail, Admin CMS, Media architecture, `Category→CategoryCard→Service→CardProduct` integrity, and analytics were all re-verified correct — no redesign was needed anywhere in that chain. One real, concrete defect was found in the CardProduct catalog/detail pricing display.

## 2. Prototype Gaps Found

**CardProduct price was never shown to the customer.** The schema's own doc comment on `CardProduct.priceAmount` explicitly documents it as "THE AMOUNT THE CUSTOMER PAYS BIAWIN"; the frontend never rendered it anywhere — only the card's `valueAmount` (its worth/credit ceiling) was ever shown, in both the CardProduct catalog grid tile and the CardProduct Detail hero. Worse, `priceLabel` (documented by the schema as an override for the *price* display) was being read by the frontend as if it were an override for the *value* display — a genuine conflation of two facts this engagement has repeatedly, deliberately kept separate since R5.19.

## 3. UI Fixes

- `apps/web/src/components/services/cardProductPresentation.ts` — `formatCardProductValue()` no longer accepts `priceLabel`; a new `formatCardProductPrice()` renders the real payable price (mirrors `Pricing.tsx`'s `Service.priceLabel` fallback convention). Distinct fallback text for each ("قیمت اعلام نشده" for price, "ارزش کارت مشخص نشده" for value) so the two are never visually interchangeable even when both are unset.
- `CardProductCard.tsx` (catalog grid tile) — now shows both, labeled "پرداخت" / "ارزش اعتبار".
- `CardProductHero.tsx` (Detail page) — now shows both, labeled "پرداخت به بیاوین" / "ارزش اعتبار کارت", in a dedicated card block.

## 4. Admin Fixes

None needed. `CardProductForm.tsx` already had the correct, unambiguous separation — a "مبلغ (ریال)" field with an explicit "no gateway connection" hint, and a separate "ارزش/سقف کارت (ریال)" field with an explicit "do not confuse with the amount above" hint. The bug was customer-display-only.

## 5. Media Architecture

Unchanged, re-confirmed correct (R5.21/R5.22). `categories/` remains reference-only — re-confirmed by grep, zero application-code references.

## 6. Category → CategoryCard → Service → CardProduct Integrity

Unchanged, re-confirmed correct. No direct `CategoryCard → CardProduct` relationship exists; ownership is enforced server-side at both hops and proven at the authenticated-QA layer (R5.24).

## 7. Analytics

Unchanged, re-confirmed correct. All six events from the union exist and fire from real call sites; `PurchaseCTAClicked` remains honestly undeclared at any call site since no real enabled purchase button exists yet.

## 8. Backend Changes

None. This stage's one real defect and fix were entirely in the customer web app's presentation layer.

## 9. Frontend Changes

`cardProductPresentation.ts`, `CardProductCard.tsx`, `CardProductHero.tsx` (all described in §3), plus their test files (`cardProductPresentation.test.ts`, `CardProductCard.test.tsx`, `CardProductDetailComposition.test.tsx`) updated to prove price and value are genuinely independent (a huge `priceAmount` with no `valueAmount` renders as price, never as value, and vice versa — mirroring the existing "never derives value from priceAmount" test discipline from R5.19, extended to the new function).

## 10. Admin Changes

None (§4).

## 11. Database/Migration Changes

None — no schema change was needed or made this stage.

## 12. Test Counts

Web: **144 passing** (was 139 before this stage; 5 new/updated assertions across 3 test files, all proving the price/value independence). Backend: **249 passing**, unchanged (no backend code touched). Admin: **84 passing**, unchanged (no admin code touched). No regressions anywhere.

## 13. Local Browser QA

Verified live against a real local stack (Postgres/Redis/backend/web), authenticated via the documented `STAGING_TEST_AUTH` bypass (avoids the OTP-request throttle, same technique established in R5.24): navigated to the real seeded CardProduct (`کارت اعتباری بیمه شخص ثالث`, `priceAmount: 1,000,000` Rial, `valueAmount: 30,000,000` Rial, `UP_TO`) via its real Service Detail page, confirmed the catalog tile shows "پرداخت / ۱۰۰,۰۰۰ تومان" and "ارزش اعتبار / تا سقف ۳,۰۰۰,۰۰۰ تومان اعتبار" as two distinct real numbers, clicked through to CardProduct Detail, confirmed the same two facts render correctly there under "پرداخت به بیاوین" / "ارزش اعتبار کارت", and screenshotted the result (RTL-correct, no overflow, matches the prototype's own price+value example format).

## 14. Staging Authenticated QA

**Not run from this environment.** `/srv/biawin-staging` does not exist here — confirmed again (`ls /srv` fails). Per the R5.24 staging results reported at the start of this stage (83 PASS / 0 FAIL / 3 NOT_TESTED, all three NOT_TESTED cases caused by missing catalog data unrelated to this stage's fix), this stage's own fix does not touch anything those checks exercise — it is a pure presentation-layer change with new/updated unit test coverage, verified locally (§13) as the closest available substitute.

## 15. Staging Browser QA

**Not run from this environment**, same reason as §14.

## 16. Commit Hash

See the final response — committed and pushed to `main` after this report was written and all local gates in §12 passed.

## 17. Deployment Result

**Not executed.** Same environment limitation as §14/§15 — no path to `/srv/biawin-staging` from here. The commands to run once access exists are unchanged from R5.24's report:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
cd /srv/biawin-staging && ./deploy/staging/run-authenticated-qa.sh
```

## 18. Remaining Genuine Limitations

- Staging's actual current state remains unverifiable from this environment — the fix is verified locally with high confidence (§13) but not yet proven against the real staging catalog data.
- The 3 pre-existing NOT_TESTED cases from R5.24's staging run (no Service with authoritative pricing, no real ACTIVE+PURCHASE+priced CardProduct beyond the one seeded row, no DRAFT/INACTIVE/EXPIRED CardProduct) are unchanged by this stage — correctly not fabricated to force them green, per this stage's own explicit instruction.
- No feature redesign, no schema change, no Payment-adjacent code was introduced — `Order`/gateway/wallet/installment-execution/`CustomerCardInstance`/`UsageTransaction` remain entirely untouched, leaving R5.26 (Purchase Flow) to begin cleanly.
