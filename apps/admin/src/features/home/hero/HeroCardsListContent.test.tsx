import { renderToStaticMarkup } from "react-dom/server";
import { HeroCardsListContent } from "./HeroCardsListContent";

jest.mock("../api/home-hero-api", () => ({
  homeHeroApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }) },
}));

const mockUseAdminAuth = jest.fn();
jest.mock("../../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

function profileWithRole(role: string) {
  return { id: "admin-1", email: "a@biawin.ir", fullName: "Admin", role, lastLoginAt: null };
}

/** End-to-end wiring check (real resource component, not the generic scaffold in isolation): a CONTENT_EDITOR sees the "+ کارت جدید" control; a SUPPORT_VIEWER does not. */
describe("HeroCardsListContent RBAC wiring", () => {
  it("CONTENT_EDITOR sees the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("CONTENT_EDITOR"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<HeroCardsListContent />);
    expect(html).toContain("+ کارت جدید");
  });

  it("SUPPORT_VIEWER does not see the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("SUPPORT_VIEWER"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<HeroCardsListContent />);
    expect(html).not.toContain("+ کارت جدید");
  });
});
