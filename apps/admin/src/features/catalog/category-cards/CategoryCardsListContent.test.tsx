import { renderToStaticMarkup } from "react-dom/server";
import { CategoryCardsListContent } from "./CategoryCardsListContent";

jest.mock("../api/category-cards-admin-api", () => ({
  categoryCardsAdminApi: {
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

describe("CategoryCardsListContent RBAC wiring", () => {
  it("CONTENT_EDITOR sees the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("CONTENT_EDITOR"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<CategoryCardsListContent />);
    expect(html).toContain("+ کارت دسته‌بندی جدید");
  });

  it("SUPPORT_VIEWER does not see the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("SUPPORT_VIEWER"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<CategoryCardsListContent />);
    expect(html).not.toContain("+ کارت دسته‌بندی جدید");
  });
});
