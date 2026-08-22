/**
 * Foundation-stage token storage: localStorage, mirroring the prototype's own
 * approach (`localStorage.setItem('biawinAuth', ...)`). A production hardening
 * item (httpOnly cookies via Next.js Route Handlers) is tracked in
 * docs/07-security.md — not done here to keep Sprint 0-A scoped to the Auth
 * Flow itself.
 */
const ACCESS_TOKEN_KEY = "biawin.accessToken";
const REFRESH_TOKEN_KEY = "biawin.refreshToken";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const tokenStorage = {
  getAccessToken(): string | null {
    return isBrowser() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  },
  getRefreshToken(): string | null {
    return isBrowser() ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  },
  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
