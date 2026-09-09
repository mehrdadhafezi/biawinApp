import { renderToStaticMarkup } from "react-dom/server";
import { ServicesListContent } from "./ServicesListContent";

jest.mock("../api/services-admin-api", () => ({
  servicesAdminApi: {
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

describe("ServicesListContent RBAC wiring", () => {
  it("CONTENT_EDITOR sees the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("CONTENT_EDITOR"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<ServicesListContent />);
    expect(html).toContain("+ خدمت جدید");
  });

  it("SUPPORT_VIEWER does not see the create-new control", () => {
    mockUseAdminAuth.mockReturnValue({ isAuthenticated: true, profile: profileWithRole("SUPPORT_VIEWER"), setAuthenticated: jest.fn(), logout: jest.fn() });
    const html = renderToStaticMarkup(<ServicesListContent />);
    expect(html).not.toContain("+ خدمت جدید");
  });
});
