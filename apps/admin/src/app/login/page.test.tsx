import { renderToStaticMarkup } from "react-dom/server";
import AdminLoginPage from "./page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => ({ isAuthenticated: false, profile: null, setAuthenticated: jest.fn(), logout: jest.fn() }),
}));

/**
 * "Login rendering" — a static-render smoke test via `react-dom/server`
 * (react-dom is already a first-party dependency; no DOM environment
 * needed). See AdminLoginForm.test.ts for the actual login-flow behavior
 * (extracted as `performAdminLogin`, tested independent of rendering).
 */
describe("AdminLoginPage rendering", () => {
  it("renders an email field, a password field, and a submit button", () => {
    const html = renderToStaticMarkup(<AdminLoginPage />);

    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="submit"');
    expect(html).toContain("ورود");
  });
});
