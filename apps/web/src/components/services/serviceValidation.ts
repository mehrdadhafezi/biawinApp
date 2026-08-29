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
