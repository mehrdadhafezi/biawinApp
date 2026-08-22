"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthTokens } from "@biawin/types";
import { authApi } from "./auth-api";
import { tokenStorage } from "./token-storage";

interface AuthContextValue {
  /** `null` while the initial client-side token check hasn't run yet (avoids SSR flash). */
  isAuthenticated: boolean | null;
  setAuthenticated: (tokens: AuthTokens) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Intentional: localStorage isn't available during SSR, so the initial
    // auth check must happen client-side, post-mount — not an accidental
    // cascading update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthenticated(Boolean(tokenStorage.getAccessToken()));
  }, []);

  const setAuthenticated = useCallback((tokens: AuthTokens) => {
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();
    setIsAuthenticated(false);
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Already logged out locally regardless of server-side outcome.
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setAuthenticated, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
