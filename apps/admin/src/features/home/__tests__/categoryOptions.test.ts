import { buildCategoryOptions, INACTIVE_CATEGORY_SUFFIX } from "../categoryOptions";
import type { CategoryOption } from "../types";

const all: CategoryOption[] = [
  { id: "cat-active-1", name: "لوازم خانگی", active: true },
  { id: "cat-active-2", name: "پوشاک", active: true },
  { id: "cat-inactive", name: "اتومبیل", active: false },
];

describe("buildCategoryOptions", () => {
  it("offers only active categories when nothing (or an active category) is selected", () => {
    expect(buildCategoryOptions(all, "").map((o) => o.id)).toEqual(["cat-active-1", "cat-active-2"]);
    expect(buildCategoryOptions(all, "cat-active-2").map((o) => o.id)).toEqual(["cat-active-1", "cat-active-2"]);
  });

  it("keeps an inactive category the row already references visible and selectable, marked as inactive", () => {
    const options = buildCategoryOptions(all, "cat-inactive");
    expect(options[0]).toEqual({ id: "cat-inactive", label: `اتومبیل${INACTIVE_CATEGORY_SUFFIX}`, inactive: true });
    expect(options.map((o) => o.id)).toContain("cat-active-1");
    expect(options.filter((o) => o.id === "cat-inactive")).toHaveLength(1);
  });

  it("the user may still replace it with an active category (active options remain)", () => {
    const options = buildCategoryOptions(all, "cat-inactive");
    expect(options.filter((o) => !o.inactive).map((o) => o.id)).toEqual(["cat-active-1", "cat-active-2"]);
  });

  it("never rewrites the id: the selected id is returned as-is", () => {
    expect(buildCategoryOptions(all, "cat-inactive")[0].id).toBe("cat-inactive");
  });

  it("uses the row's own categoryName when the id is missing from the fetched list", () => {
    const options = buildCategoryOptions(all, "cat-missing", "بیمه");
    expect(options[0]).toEqual({ id: "cat-missing", label: `بیمه${INACTIVE_CATEGORY_SUFFIX}`, inactive: true });
  });
});
