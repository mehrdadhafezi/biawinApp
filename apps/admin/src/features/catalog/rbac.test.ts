import { canManageCatalog } from "./rbac";

describe("canManageCatalog", () => {
  it("SUPER_ADMIN and CONTENT_EDITOR can manage the catalog", () => {
    expect(canManageCatalog("SUPER_ADMIN")).toBe(true);
    expect(canManageCatalog("CONTENT_EDITOR")).toBe(true);
  });

  it("SUPPORT_VIEWER is read-only", () => {
    expect(canManageCatalog("SUPPORT_VIEWER")).toBe(false);
  });

  it("an unresolved profile (null/undefined, still loading) is treated as read-only, not management", () => {
    expect(canManageCatalog(null)).toBe(false);
    expect(canManageCatalog(undefined)).toBe(false);
  });
});
