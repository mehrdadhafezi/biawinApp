import type { ID } from "./common";

/**
 * Mirrors `backend/prisma/schema.prisma`'s `AdminRole` enum exactly (see
 * docs/admin-architecture-decision-record.md §4) — a fixed, closed set,
 * not free-form.
 */
export type AdminRole = "SUPER_ADMIN" | "CONTENT_EDITOR" | "SUPPORT_VIEWER";

/** POST /admin/auth/login */
export interface AdminLoginInput {
  email: string;
  password: string;
}

/** Matches the raw shape returned by GET /admin/auth/me. */
export interface AdminProfile {
  id: ID;
  email: string;
  fullName: string;
  role: AdminRole;
  lastLoginAt: string | null;
}
