import { renderToStaticMarkup } from "react-dom/server";
import { CategoriesListContent } from "./CategoriesListContent";

jest.mock("../api/categories-admin-api", () => ({
  categoriesAdminApi: {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }),
    update: jest.fn(),
    reorder: jest.fn(),
  },
}));

const mockUseAdminAuth = jest.fn();
jest.mock("../../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

function profileWithRole(role: string) {
  return { id: "admin-1", email: "a@biawin.ir", fullName: "Admin", role, lastLoginAt: null };
}

describe("CategoriesListContent RBAC wiring", () => {
  it("CONTENT_EDITOR sees the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("CONTENT_EDITOR"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<CategoriesListContent />);
    expect(html).toContain("+ دسته‌بندی جدید");
  });

  it("SUPPORT_VIEWER does not see the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("SUPPORT_VIEWER"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<CategoriesListContent />);
    expect(html).not.toContain("+ دسته‌بندی جدید");
  });
});
