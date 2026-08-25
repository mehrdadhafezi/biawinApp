import { resolveInitialAuthState } from "./admin-auth-context";

/**
 * `resolveInitialAuthState` is factored out of `AdminAuthProvider`'s
 * `useEffect` specifically so "auth state restoration" is testable as
 * plain async logic — no React rendering or DOM environment required (see
 * jest.config.js's comment for why: `jest-environment-jsdom` and
 * `@testing-library/*` were unreachable from this environment for the
 * entire implementation window).
 */
describe("resolveInitialAuthState", () => {
  it("restores an authenticated session and profile from a stored access token", async () => {
    const profile = {
      id: "admin-1",
      email: "admin@biawin.ir",
      fullName: "Test Admin",
      role: "SUPER_ADMIN" as const,
      lastLoginAt: null,
    };
    const clearTokens = jest.fn();

    const result = await resolveInitialAuthState({
      getAccessToken: () => "existing-access-token",
      fetchProfile: () => Promise.resolve(profile),
      clearTokens,
    });

    expect(result).toEqual({ isAuthenticated: true, profile });
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it("treats a missing token as unauthenticated without ever calling the API", async () => {
    const fetchProfile = jest.fn();

    const result = await resolveInitialAuthState({
      getAccessToken: () => null,
      fetchProfile,
      clearTokens: jest.fn(),
    });

    expect(result).toEqual({ isAuthenticated: false, profile: null });
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it("clears stored tokens and reports unauthenticated when the token is no longer valid (expired/revoked/disabled account)", async () => {
    const clearTokens = jest.fn();

    const result = await resolveInitialAuthState({
      getAccessToken: () => "stale-access-token",
      fetchProfile: () => Promise.reject(new Error("401 Unauthorized")),
      clearTokens,
    });

    expect(result).toEqual({ isAuthenticated: false, profile: null });
    expect(clearTokens).toHaveBeenCalledTimes(1);
  });
});
