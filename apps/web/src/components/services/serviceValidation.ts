import type { ServiceDto } from "../../lib/services-api";

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
