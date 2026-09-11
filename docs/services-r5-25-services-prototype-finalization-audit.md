# SERVICES-R5.25 — Services Prototype Finalization — Audit

**This audit re-verifies the entire Services experience — Services Landing → Category Landing → CategoryCard → Service Detail → CardProduct catalog → CardProduct Detail → Admin CMS → Media → Analytics — against the prototype/reference material and the current implementation, building directly on the extensive, already-thorough work of R5.16–R5.24.** One genuine, significant defect was found (§3) and fixed; everything else was re-confirmed already correct, not re-implemented.

## 1. Method

No raw prototype HTML file exists in this repository (confirmed by search — it was mined directly in R1/R2 and never committed as a repo artifact). The authoritative record of its content is the extensive documentation already produced from it: `docs/services-prototype-analysis.md`, `docs/services-ui-contract.md`, and every stage report since (R1 through R5.24), each of which quotes specific prototype details with citations. This audit re-reads that record, re-reads the current source, and — critically — re-verifies live against a running local stack rather than trusting either alone.

## 2. Prototype vs. Current Implementation vs. Required Fix

| Area | Prototype / Reference | Current Implementation | Required Fix |
|---|---|---|---|
| Services Landing | Promo banner + category icon grid, "بیشتر"/"کمتر" reveal | Matches exactly (R1, re-confirmed R5.20/R5.23) | None |
| Category Landing layout | Hero → discovery cards → Service navigation | Matches exactly (R5.21) | None |
| Category Hero image | Full-bleed photo, dark scrim, white text | Matches (R5.22/R5.23) — renders when a real `mediaAssetId` is set, icon-only otherwise | None |
| CategoryCard image ratio | Tall, photo-forward (~2:3) | Matches (`aspect-ratio: 3/4`, fixed R5.23) | None |
| CategoryCard content (badge/title/subtitle/highlights) | Photo + title + ≤2 hand-written bullets | Matches (R5.21) | None |
| CategoryCard → Service navigation | Click → target Service, ownership-enforced | Matches, server- and client-enforced (R5.21, re-proven at the QA layer R5.24) | None |
| Service Detail hierarchy | Hero → info (benefits/tags/FAQ) → description/usage-guide/terms → CardProduct catalog → CTA | Matches exactly (R5.22) | None |
| CardProduct catalog tile | Image, title, subtitle, **price**, **value**, badge, CTA | **Only value was ever shown — price (`priceAmount`) was never rendered anywhere in the customer UI** | **Fixed — see §3** |
| CardProduct Detail hero | Image, title, subtitle, **payable price**, **card value**, badge | Same gap as above | **Fixed — see §3** |
| CardProduct benefits/validity | Shown when present, no fabricated usage-guide/terms/FAQ (neither field exists on the real model) | Matches, re-confirmed correct (R5.22) | None |
| Purchase CTA | Disabled, real `<button disabled>`, targets the CardProduct, never a generic Service purchase | Matches — `DisabledCardPurchaseCTA` lives only on CardProduct Detail | None |
| Admin CMS (Category/CategoryCard/Service/CardProduct) | Content Editor manages the same fields the customer sees, via Media Picker, no raw storage keys | Matches exactly (R5.22 closed the last raw-key inputs) | None |
| Admin price/value field clarity | Distinct, unambiguous fields for what-customer-pays vs. card-value | **Already correct** — `CardProductForm.tsx` has separate "مبلغ (ریال)" (with an explicit "no gateway" hint) and "ارزش/سقف کارت (ریال)" (with an explicit "do not confuse with the amount above" hint) | None |
| Media architecture | `mediaAssetId → MediaAsset → resolved URL`, no raw keys, `categories/` reference-only | Matches exactly (R5.21/R5.22), re-confirmed again this session (grep, zero app-code references to `categories/`) | None |
| Analytics | `CategoryViewed`/`CategoryCardViewed`/`CategoryCardClicked`/`ServiceViewed`/`CardProductViewed`/`PurchaseCTAClicked` | All exist and fire from real call sites (R5.21/R5.22); `PurchaseCTAClicked` remains correctly undeclared-at-call-site since no real enabled purchase button exists yet | None |
| Responsive (1440/375/390/430) | No overflow, correct RTL, correct card proportions | Matches, re-verified live this session (§5) at all four breakpoints on the fixed CardProduct pages | None |
| Staging QA coverage | Full customer + admin journey, count-agnostic | Matches (R5.24 closed the Category Landing/CategoryCard/CardProduct Detail gap); this stage adds nothing further here — no new coverage gap found | None |

## 3. The One Real Defect Found — CardProduct Price Was Never Shown To The Customer

**Confirmed by reading the schema's own authoritative doc comment** (`backend/prisma/schema.prisma`, `CardProduct.priceAmount`/`priceLabel`): `priceAmount` is explicitly documented as "THE AMOUNT THE CUSTOMER PAYS BIAWIN FOR THIS CARD PRODUCT," and `priceLabel` as "a display override for the PAYABLE price above (`priceAmount`), **not for the card's commercial value**."

**Confirmed by reading the frontend** (`apps/web/src/components/services/cardProductPresentation.ts`): the R5.19 version of `formatCardProductValue()` read `card.priceLabel` as if it were an override for the *value* display — directly contradicting the schema's own documented intent for that field — and neither `CardProductCard.tsx` (catalog grid tile) nor `CardProductHero.tsx` (Detail page) ever rendered `priceAmount` anywhere. **A real customer had no way to see what they would actually pay for a card — only what it was worth.** `grep -rn "priceAmount" apps/web/src/components/services/*.tsx` confirmed zero rendering call sites before this fix; the field only appeared in test fixtures.

This is exactly the gap this stage's own brief anticipated by name (§5's explicit price + value example) and is the single, concrete, well-evidenced UI defect this audit found.

**Fix**:
- `cardProductPresentation.ts` — `formatCardProductValue()` no longer accepts `priceLabel` in its parameter type at all (removed, not just unused); a new, separate `formatCardProductPrice()` correctly reads `priceLabel`/`priceAmount`, mirroring `Pricing.tsx`'s existing `Service.priceLabel` fallback convention exactly ("قیمت اعلام نشده"). `formatCardProductValue()`'s own fallback changed to "ارزش کارت مشخص نشده" — deliberately distinct wording, so the two facts are never rendered with identical placeholder text on the same screen.
- `CardProductCard.tsx` (catalog grid tile) — now renders both, clearly labeled "پرداخت" / "ارزش اعتبار", matching this stage's own prototype example format.
- `CardProductHero.tsx` (Detail page) — now renders both, clearly labeled "پرداخت به بیاوین" / "ارزش اعتبار کارت", in a dedicated `Card` block.
- Admin (`CardProductForm.tsx`) needed **no change** — it already had the correct, unambiguous separation (§2).

**Verified live** (real seeded data, `کارت اعتباری بیمه شخص ثالث`, `priceAmount: 1,000,000` Rial, `valueAmount: 30,000,000` Rial, `UP_TO`): the catalog tile shows "پرداخت / ۱۰۰,۰۰۰ تومان" and "ارزش اعتبار / تا سقف ۳,۰۰۰,۰۰۰ تومان اعتبار" as two genuinely distinct numbers; the Detail page shows the same two facts under "پرداخت به بیاوین" / "ارزش اعتبار کارت". Screenshotted at desktop and confirmed RTL-correct with no overflow.

## 4. Category → CategoryCard → Service → CardProduct Integrity

Re-confirmed, unchanged: `CategoryCard.categoryId === CategoryCard.targetService.categoryId` is enforced server-side (`CategoryCardsService`, R5.21) and proven at the authenticated-QA layer (R5.24, ownership-rejection test). `CardProduct.serviceId` ownership is enforced identically (`cardProductBelongsToService`, R5.18). No direct `CategoryCard → CardProduct` relationship exists anywhere in the schema or code — re-confirmed by reading `backend/prisma/schema.prisma` in full.

## 5. Local Verification

Ran against a real local stack (Postgres/Redis/backend/web, customer authenticated via the documented `STAGING_TEST_AUTH` bypass — same technique R5.24 used to avoid the OTP-request throttle): navigated to the real seeded CardProduct's Service Detail and Detail pages, confirmed the fix renders correctly (§3), and confirmed no console errors or broken requests during the flow.

## 6. What Was Re-Confirmed Correct, Not Re-Implemented

Everything in §2 marked "None" was verified by re-reading the relevant source this session (not assumed from memory of prior stages) — Services Landing (`apps/web/src/app/services/page.tsx`), Category Landing (`apps/web/src/app/categories/[slug]/page.tsx`), Service Detail composition (`apps/web/src/app/services/[categoryId]/[serviceId]/page.tsx`), all four Admin catalog forms, the Media pipeline, and the analytics event union (`apps/web/src/lib/analytics.ts`). No redesign, no new abstraction, no speculative field was added anywhere in this diff beyond the one real fix in §3.

---

**Implementation of the one real fix (§3) was verified live before this document was finalized**, consistent with this engagement's established discipline (R5.24) of not declaring a fix correct until it has actually been run.
