import { renderToStaticMarkup } from "react-dom/server";
import { AdminRouteGuard, shouldRedirectFromGuard } from "./AdminRouteGuard";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockUseAdminAuth = jest.fn();
jest.mock("../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

/**
 * The redirect *decision* is a plain function (`shouldRedirectFromGuard`),
 * unit-tested directly. `renderToStaticMarkup` (from `react-dom/server`,
 * already a first-party dependency — no DOM environment needed) confirms
 * the component actually suppresses/shows its children the same way. What
 * this does NOT cover: the `router.replace(...)` call itself, which only
 * fires from a real `useEffect` in a mounted DOM — SSR never runs effects.
 * That call is a direct one-liner gated by the same tested boolean
 * (`if (shouldRedirect) router.replace(redirectTo)`), so the risk left
 * uncovered is narrow; disclosed explicitly rather than silently assumed
 * (see docs/admin-portal-shell-report.md).
 */
describe("shouldRedirectFromGuard", () => {
  it("require-auth: redirects only when explicitly signed out (false), not while loading (null) or signed in (true)", () => {
    expect(shouldRedirectFromGuard("require-auth", false)).toBe(true);
    expect(shouldRedirectFromGuard("require-auth", true)).toBe(false);
    expect(shouldRedirectFromGuard("require-auth", null)).toBe(false);
  });

  it("require-guest: redirects only when explicitly signed in (true), not while loading (null) or signed out (false)", () => {
    expect(shouldRedirectFromGuard("require-guest", true)).toBe(true);
    expect(shouldRedirectFromGuard("require-guest", false)).toBe(false);
    expect(shouldRedirectFromGuard("require-guest", null)).toBe(false);
  });
});

describe("AdminRouteGuard rendering", () => {
  beforeEach(() => {
    mockUseAdminAuth.mockReset();
  });

  it("does not render protected content for a signed-out visitor on a require-auth route", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: false, profile: null, setAuthenticated: jest.fn(), logout: jest.fn() });

    const html = renderToStaticMarkup(
      <AdminRouteGuard mode="require-auth" redirectTo="/login">
        <div>محتوای محافظت‌شده</div>
      </AdminRouteGuard>,
    );

    expect(html).not.toContain("محتوای محافظت‌شده");
  });

  it("renders protected content once authenticated", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: null, setAuthenticated: jest.fn(), logout: jest.fn() });

    const html = renderToStaticMarkup(
      <AdminRouteGuard mode="require-auth" redirectTo="/login">
        <div>محتوای محافظت‌شده</div>
      </AdminRouteGuard>,
    );

    expect(html).toContain("محتوای محافظت‌شده");
  });

  it("does not render the login form for an already-authenticated visitor on a require-guest route", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: null, setAuthenticated: jest.fn(), logout: jest.fn() });

    const html = renderToStaticMarkup(
      <AdminRouteGuard mode="require-guest" redirectTo="/dashboard">
        <div>فرم ورود</div>
      </AdminRouteGuard>,
    );

    expect(html).not.toContain("فرم ورود");
  });
});
