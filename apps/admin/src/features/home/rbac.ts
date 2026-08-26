import type { AdminRole } from "@biawin/types";

/**
 * `SUPER_ADMIN`/`CONTENT_EDITOR` manage Home content; `SUPPORT_VIEWER` is
 * read-only. This is a UX convenience only — `AdminRolesGuard` on the
 * backend (backend/src/common/guards/admin-roles.guard.ts) is the actual
 * authorization boundary; hiding controls here never substitutes for it.
 */
export function canManageHomeContent(role: AdminRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CONTENT_EDITOR";
}
