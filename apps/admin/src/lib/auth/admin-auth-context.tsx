"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AdminProfile, AuthTokens } from "@biawin/types";
import { adminAuthApi } from "./admin-auth-api";
import { adminTokenStorage } from "./admin-token-storage";

interface AdminAuthContextValue {
  /** `null` while the initial client-side session check hasn't run yet (avoids SSR flash). */
  isAuthenticated: boolean | null;
  /** The signed-in admin's profile (id/email/fullName/role) once known — `null` until then. */
  profile: AdminProfile | null;
  setAuthenticated: (tokens: AuthTokens) => void;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export interface ResolveInitialAuthStateDeps {
  getAccessToken: () => string | null;
  fetchProfile: () => Promise<AdminProfile>;
  clearTokens: () => void;
}

export interface AuthState {
  isAuthenticated: boolean;
  profile: AdminProfile | null;
}

/**
 * The actual "session restoration" decision, factored out of the
 * `useEffect` below as a plain, dependency-injected async function so it's
 * directly unit-testable without rendering anything (no DOM/React
 * needed — see admin-auth-context.test.ts). No token at all →
 * unauthenticated without a network call. A token that fails to resolve a
 * profile (expired, revoked, or the account was disabled after issuance —
 * `AdminJwtStrategy` re-checks `AdminUser.active` server-side on every
 * request) clears storage and reports unauthenticated, same as a session
 * that never existed.
 */
export async function resolveInitialAuthState(deps: ResolveInitialAuthStateDeps): Promise<AuthState> {
  if (!deps.getAccessToken()) {
    return { isAuthenticated: false, profile: null };
  }
  try {
    const profile = await deps.fetchProfile();
    return { isAuthenticated: true, profile };
  } catch {
    deps.clearTokens();
    return { isAuthenticated: false, profile: null };
  }
}

/**
 * Mirrors apps/web's `AuthProvider` (`lib/auth/auth-context.tsx`) in shape
 * and responsibility split — the caller (e.g. the login form) performs the
 * actual `adminAuthApi.login()` call and hands the resulting tokens to
 * `setAuthenticated`; this provider owns only state + storage side effects.
 * It goes one step further than the customer version by also resolving the
 * signed-in admin's *profile* (needed for role-aware UI, e.g. hiding a
 * SUPER_ADMIN-only sidebar item from a CONTENT_EDITOR) — GET /admin/auth/me
 * doubles as both "who is this" and "is this token/account still valid".
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const restore = useCallback(async () => {
    const result = await resolveInitialAuthState({
      getAccessToken: () => adminTokenStorage.getAccessToken(),
      fetchProfile: () => adminAuthApi.me(),
      clearTokens: () => adminTokenStorage.clear(),
    });
    setIsAuthenticated(result.isAuthenticated);
    setProfile(result.profile);
  }, []);

  useEffect(() => {
    // Intentional: localStorage isn't available during SSR, so the initial
    // session check must happen client-side, post-mount — not an
    // accidental cascading update (same pattern/justification as apps/web's
    // own AuthProvider effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
  }, [restore]);

  const setAuthenticated = useCallback(
    (tokens: AuthTokens) => {
      adminTokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
      setIsAuthenticated(true);
      void restore();
    },
    [restore],
  );

  const logout = useCallback(async () => {
    const refreshToken = adminTokenStorage.getRefreshToken();
    adminTokenStorage.clear();
    setIsAuthenticated(false);
    setProfile(null);
    if (refreshToken) {
      try {
        await adminAuthApi.logout(refreshToken);
      } catch {
        // Already logged out locally regardless of server-side outcome.
      }
    }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, profile, setAuthenticated, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within <AdminAuthProvider>");
  return ctx;
}
