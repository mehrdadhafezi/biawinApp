import { renderToStaticMarkup } from "react-dom/server";
import AdminMediaPage from "./page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/media",
}));

jest.mock("../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => ({
    isAuthenticated: true,
    profile: { id: "admin-1", email: "admin@biawin.ir", fullName: "Test Admin", role: "SUPER_ADMIN", lastLoginAt: null },
    setAuthenticated: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock("../../lib/media/media-api", () => ({
  mediaApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 50 }) },
}));

/**
 * "Media page render" — a static-render smoke test (see
 * apps/admin's Stage 5.17 report for why: `@testing-library/*` was
 * unreachable from this environment). `mediaApi.list()` is mocked so the
 * component's initial synchronous render (before its `useEffect` resolves,
 * which SSR never runs anyway) is what's being asserted — the loading
 * state, the shell chrome, and the upload form all being present.
 */
describe("AdminMediaPage rendering", () => {
  it("renders the page heading, the upload form, and the admin shell chrome", () => {
    const html = renderToStaticMarkup(<AdminMediaPage />);

    expect(html).toContain("کتابخانه رسانه");
    expect(html).toContain('type="file"');
    expect(html).toContain("آپلود");
    expect(html).toContain("داشبورد"); // sidebar nav item, confirms AdminShell rendered
  });
});
