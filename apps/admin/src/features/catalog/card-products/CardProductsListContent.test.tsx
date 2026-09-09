import { renderToStaticMarkup } from "react-dom/server";
import { CardProductsListContent } from "./CardProductsListContent";

jest.mock("../api/card-products-admin-api", () => ({
  cardProductsAdminApi: {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }),
    update: jest.fn(),
  },
}));

const mockUseAdminAuth = jest.fn();
jest.mock("../../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

function profileWithRole(role: string) {
  return { id: "admin-1", email: "a@biawin.ir", fullName: "Admin", role, lastLoginAt: null };
}

describe("CardProductsListContent RBAC wiring", () => {
  it("CONTENT_EDITOR sees the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("CONTENT_EDITOR"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<CardProductsListContent />);
    expect(html).toContain("+ کارت محصول جدید");
  });

  it("SUPPORT_VIEWER does not see the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("SUPPORT_VIEWER"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<CardProductsListContent />);
    expect(html).not.toContain("+ کارت محصول جدید");
  });
});
