# SERVICES-R5.16 — Services & Card Catalog Contract

See `docs/services-r5-16-audit.md` for the repository audit this contract is built on — most importantly its §7 finding: a business open-questions document exists alongside this stage's task, proving most of this domain (refunds, credit reservation, split payment, SSO, webhook idempotency, exact fulfillment semantics) is still genuinely unresolved beyond the task's six stated decisions. This stage implements only what those six decisions and existing, proven patterns (`MembershipPlan`/`Membership`, `Order`'s snapshot/state-machine pattern) can support safely.

## 1. Final Domain Model

```
Service Category (Category — existing, unchanged)
        │
        ▼
      Service (existing, unchanged)
        │
        ▼
   Card Product (new)
        │
        ▼
Customer Card Instance (new)
        │
        ▼
  Usage Transaction (new)
```

`Category` and `Service` needed no changes — the audit (§2) found `Category` already fits "Service Category" exactly, and `Service` already fits the task's own examples ("Vehicle purchase," "Vehicle service," "Insurance" under "Automotive"). Everything genuinely new starts at `CardProduct`.

## 2. Entity Relationships

- `Service 1 — N CardProduct` (`CardProduct.serviceId`, `onDelete: Restrict` — a Service cannot be deleted while it has card products, matching `Order`'s own relation to `Service`).
- `User 1 — N CustomerCardInstance` (`onDelete: Cascade`, matching every other user-owned financial model — `Wallet`, `CreditLine`, `Installment`, `Order`).
- `CardProduct 1 — N CustomerCardInstance` (`onDelete: Restrict`).
- `Order 1 — 0/1 CustomerCardInstance` (`CustomerCardInstance.orderId`, nullable + unique — one Order can issue at most one card instance; nullable because, per the audit, this stage does not require every row to originate from an Order at the database level — see §6).
- `CustomerCardInstance 1 — N UsageTransaction` (`onDelete: Cascade`).

`CardType` (`CREDIT_CARD | DISCOUNT_CARD | SUBSCRIPTION | VOUCHER | INSTALLMENT_CARD`), `JourneyType` (`PURCHASE | CREDIT_REQUEST | LEAD | EXTERNAL_REDIRECT | QUOTE_REQUEST | FREE_SERVICE`), and `CustomerCardStatus` (`CREATED | PURCHASED | ACTIVE | PARTIALLY_USED | USED | EXPIRED | CANCELLED`) are exactly the enums the task specified — nothing added, nothing renamed.

**Journey type placement decision**: the task asked whether `journeyType` belongs on `Service` or `CardProduct`. The business's own open-questions document poses this as "for each Service, what journey(s)?" and explicitly allows a Service to have several journeys at once (e.g. direct purchase, consultation request, and installment purchase, all for the same Service). Putting one `journeyType` field on `Service` cannot represent that. Putting it on `CardProduct` can: a Service simply gets multiple `CardProduct` children, each with its own single `journeyType` — "purchase" and "request a quote" become two different cards under the same Service, exactly matching real-world catalog UX (a page offering both "buy now" and "request a quote" as separate actions). **Decision: `journeyType` lives on `CardProduct`, one per card.**

## 3. API Contract

Implemented (read-only, matching the task's explicit "do not implement unnecessary endpoints"):

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/cards` | Public | Lists active `CardProduct`s; optional `?serviceId=` filter |
| GET | `/api/v1/cards/:id` | Public | One active `CardProduct` |
| GET | `/api/v1/customer/cards` | Authenticated | The caller's own `CustomerCardInstance`s |
| GET | `/api/v1/customer/cards/:id` | Authenticated | Ownership-scoped; 404 (not 403) for another user's card, matching `Order`'s existing convention |
| GET | `/api/v1/customer/cards/:id/usage` | Authenticated | Ownership-checked before the usage query runs, so a nonexistent/foreign id never reveals whether it exists |

**Deliberately not implemented this stage**: any `POST`/`PUT`/`PATCH`/`DELETE` on any of the above. Creating a real `CustomerCardInstance` requires a purchase-execution path (Order → payment → issuance) whose exact rules — refund/cancellation, credit reservation, fulfillment-vs-payment separation — the audit's §7 shows are still open business questions. Building that path now would mean inventing answers to them, which this engagement's established discipline (R5.1, R5.2) explicitly avoids. Admin CRUD is likewise not implemented — see §4.

## 4. Admin Requirements

Per the task's own instruction ("Determine which fields are CMS content, which are business rules" — not "build the screens"):

- **CMS content** (safe for a future Admin UI to edit directly, no business-rule risk): `title`, `subtitle`, `description`, `imageKey`, `badge`, `benefits`, `sortOrder`, `active` — identical in kind to what Home CMS already manages for other content types.
- **Business rules** (require the still-open decisions from the audit's §7 before any UI should expose them): `priceAmount` (who's authorized to change it, and whether changes need approval/history — the docx explicitly asks "should price changes have full history?"), `cardType`/`journeyType` (changing these after real instances exist has lifecycle implications not yet designed), `validityDays` (interacts with the still-undecided expiry/refund rules), `providerConfig` (interacts with the still-undecided external-system integration).

**No Admin CRUD is built this stage.** The reusable pattern (RBAC + CRUD + audit log, proven by Home CMS) is identified and ready to apply once the business-rule fields above are unblocked — see R5.2.1's own conclusion that Biawin Admin, not a Merchant Portal, is the correct owner under the confirmed Model A decision.

## 5. Prototype Alignment

Per the audit (§6), the prototype (v15 and the newly-found v19 variant) has no structured `CardProduct` equivalent — its "cards" are purchase-*method* framings (اعتباری/اقساطی/تخفیفی/ترکیبی), and its purchase flow makes no backend call at all (re-confirmed from R5.2 §3, unchanged). The one concrete UI element with a direct mapping: the profile page's `کارت‌های من` ("My Cards") accordion — structurally distinct from `سفارش‌ها` ("Orders") — maps to the new `GET /customer/cards` endpoint. No other UI was invented or assumed; per the task's explicit instruction, no UI was built or redesigned this stage — only the data contract a future UI would consume.

| Prototype component | Data contract | Backend source |
|---|---|---|
| Profile → `کارت‌های من` accordion | List of the user's cards, each with type/status/title | `GET /customer/cards` → `CustomerCardInstance` joined to `CardProduct` |
| (none — no prototype screen shows card usage history) | Per-card usage log | `GET /customer/cards/:id/usage` → `UsageTransaction` |
| (none — no prototype screen browses commercial card products directly; this is new, catalog-side infrastructure) | Public card catalog | `GET /cards`, `GET /cards/:id` → `CardProduct` |

## 6. Migration Decision

One additive migration, `20260908174644_card_catalog_foundation` (generated via `prisma migrate diff` against the local dev database — `prisma migrate dev` still refuses to run non-interactively, same workaround as R5.1 — then applied with `prisma migrate deploy` and verified with `prisma migrate status`): 4 new enums (`CardType`, `JourneyType`, `CustomerCardStatus`, `UsageSource`), 3 new tables (`card_products`, `customer_card_instances`, `usage_transactions`), and additive relation columns on the existing `services`/`orders`/`users` tables' Prisma models (no actual new *columns* on those tables — the new relations are all owned by the new tables' own FK columns). **No existing table is altered.** No fake/seed data was added to any new table — they start empty, exactly like `orders` did after R5.1, since nothing yet has a real reason to write to them.

## 7. Future Extension Points

Directly gated by the audit's §7 findings — each of these needs a real business answer, not an engineering guess, before it can be built:

- **Purchase-execution wiring**: `OrdersService.create()` (or a new command) issuing a real `CustomerCardInstance` on a successful Order — blocked on refund/cancellation rules and credit-reservation semantics (docx).
- **Usage-tracking ingestion**: the task's own "API callback / Webhook / Manual confirmation" — blocked on webhook idempotency and source-of-truth-on-conflict rules (docx), and needs its own dedicated security review (an inbound, likely externally-triggered endpoint) before being built, the same caution R5.2 already flagged for the Payment/gateway boundary's missing idempotency.
- **Admin CRUD for `CardProduct`**: reuses the proven Home CMS RBAC/audit pattern directly — the *lowest-risk* next increment once `priceAmount`'s governance rules (§4) are answered.
- **`journeyType`-specific handling**: today every `JourneyType` is stored identically; `LEAD`/`QUOTE_REQUEST` journeys likely need an entirely different (non-`Order`, non-payment) flow once built — explicitly not designed this stage.
- **Deprecating `Service.priceFrom`/`availableMethods`** in favor of `CardProduct`-level pricing/methods, once real `CardProduct` rows exist for enough of the catalog to make the old fields redundant — not touched this stage for backward compatibility (R1–R5.1 still depend on them).
