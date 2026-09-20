import type { CardProductDto, ServiceDto } from "../../lib/services-api";

/**
 * SERVICES-R3 (§13 "Not Found / Data Integrity") — `GET /services/:id`
 * has no category-scoping of its own, so a real Service fetched by ID
 * alone could belong to a *different* real Category than the one in the
 * current URL. A Service must never be treated as valid for a Category
 * it doesn't actually belong to, even though it's a real, existing row.
 */
export function belongsToCategory(service: ServiceDto, categoryId: string): boolean {
  return service.categoryId === categoryId;
}

/**
 * SERVICES-R4 — the same principle extended one relationship further:
 * `GET /merchants/:id` has no service-scoping of its own either, so a
 * real, existing Merchant fetched by ID alone says nothing about whether
 * THIS Service actually sells through them. A Merchant must never be
 * treated as valid for a Service it isn't actually linked to via
 * `Service.merchantId` — even a real, active Merchant.
 */
export function serviceReferencesMerchant(service: ServiceDto, merchantId: string): boolean {
  return service.merchantId === merchantId;
}

/**
 * SERVICES-R5.18 — the same principle applied to the new
 * `/services/[categoryId]/[serviceId]/cards/[cardProductId]` route:
 * `GET /cards/:id` has no service-scoping of its own either, so a real,
 * active CardProduct fetched by ID alone says nothing about whether it
 * actually belongs to THIS Service. A CardProduct must never be treated
 * as valid for a Service it isn't actually linked to via
 * `CardProduct.serviceId` — even a real, ACTIVE one.
 */
export function cardProductBelongsToService(cardProduct: CardProductDto, serviceId: string): boolean {
  return cardProduct.serviceId === serviceId;
}

/**
 * The click target of a CardProduct on the Category Landing: STRAIGHT to that
 * CardProduct's detail page. `Service` is an internal entity, not a customer
 * page, so its id appears only as the card's own owner segment of the
 * existing `/services/[categoryId]/[serviceId]/cards/[cardProductId]` route
 * (validated on arrival by `belongsToCategory` + `cardProductBelongsToService`)
 * — no Service page is visited on the way. Extracted as a pure function,
 * like every other navigation/relationship rule in this file, so the real
 * click target is directly testable.
 */
export function cardProductDetailHref(categoryId: string, cardProduct: Pick<CardProductDto, "id" | "serviceId">): string {
  return `/services/${categoryId}/${cardProduct.serviceId}/cards/${cardProduct.id}`;
}
