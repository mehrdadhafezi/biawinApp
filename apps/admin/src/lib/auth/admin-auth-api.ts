import type { AdminLoginInput, AdminProfile, AuthTokens } from "@biawin/types";
import { apiClient } from "../api-client";

/**
 * Thin wrapper over Stage 5.16's `/admin/auth/**` endpoints
 * (backend/src/modules/admin-auth/admin-auth.controller.ts) — never calls
 * `/auth/**` (the customer endpoints).
 */
export const adminAuthApi = {
  login: (input: AdminLoginInput) =>
    apiClient.post<AuthTokens>("/admin/auth/login", input, { public: true }),

  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>("/admin/auth/refresh", { refreshToken }, { public: true }),

  logout: (refreshToken: string) =>
    apiClient.post<void>("/admin/auth/logout", { refreshToken }, { public: true }),

  me: () => apiClient.get<AdminProfile>("/admin/auth/me"),
};
