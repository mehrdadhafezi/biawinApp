import type { AdminRole } from "@biawin/types";

/**
 * SERVICES-R5.17 — same rule as features/home/rbac.ts's `canManageHomeContent`:
 * `SUPER_ADMIN`/`CONTENT_EDITOR` manage the catalog; `SUPPORT_VIEWER` is
 * read-only. No finer-grained "Service manager"/"Commercial manager" split
 * exists — `AdminRolesGuard` (the actual authorization boundary) has no
 * such role today; see docs/services-r5-17-admin-catalog-cms.md "RBAC" for
 * why this is a documented limitation, not a parallel auth system.
 */
export function canManageCatalog(role: AdminRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CONTENT_EDITOR";
}
