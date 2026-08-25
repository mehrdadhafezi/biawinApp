/**
 * Mirrors apps/web's `token-storage.ts` exactly (localStorage, same
 * production-hardening note applies — httpOnly cookies is a tracked future
 * item, not done here). Deliberately distinct key names
 * (`biawin.admin.*`, not `biawin.*`) — even though customer and admin
 * normally run on different origins, this keeps the two token stores from
 * ever colliding if the same browser profile is ever used against both
 * (e.g. local dev, where both run on `localhost` at different ports and
 * therefore already have separate origins/storage — this is belt-and-
 * braces, not the only isolation mechanism). See
 * docs/admin-architecture-decision-record.md §3 — "do not reuse customer
 * authentication" applies to storage, not just the backend.
 */
const ACCESS_TOKEN_KEY = "biawin.admin.accessToken";
const REFRESH_TOKEN_KEY = "biawin.admin.refreshToken";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const adminTokenStorage = {
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
