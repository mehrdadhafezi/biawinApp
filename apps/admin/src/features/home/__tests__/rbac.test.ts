import { canManageHomeContent } from "../rbac";

describe("canManageHomeContent", () => {
  it("SUPER_ADMIN and CONTENT_EDITOR can manage Home content", () => {
    expect(canManageHomeContent("SUPER_ADMIN")).toBe(true);
    expect(canManageHomeContent("CONTENT_EDITOR")).toBe(true);
  });

  it("SUPPORT_VIEWER is read-only", () => {
    expect(canManageHomeContent("SUPPORT_VIEWER")).toBe(false);
  });

  it("an unresolved profile (null/undefined, still loading) is treated as read-only, not management", () => {
    expect(canManageHomeContent(null)).toBe(false);
    expect(canManageHomeContent(undefined)).toBe(false);
  });
});
