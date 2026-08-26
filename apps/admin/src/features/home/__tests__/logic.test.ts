import { ApiError } from "../../../lib/api-client";
import { performSave, performToggleActive, performReorder, performRemove, moveItem } from "../logic";

interface FakeItem {
  id: string;
  sortOrder: number;
  active: boolean;
}

function makeItem(id: string, sortOrder: number, active = true): FakeItem {
  return { id, sortOrder, active };
}

/**
 * These plain-function tests cover the shared save/toggle/reorder/remove
 * logic used by all 4 Home resources (hero cards, service banners, service
 * mosaic tiles, news articles) — each resource's list/form component wires
 * the same functions to its own dedicated API module (see
 * `HeroCardsListContent.tsx` etc.), so testing the shared logic once here
 * covers "create/update flow", "active toggle", and "reorder" for every
 * resource without needing a DOM (npm registry unreachable for
 * `@testing-library/*`/`jest-environment-jsdom` — same constraint as every
 * prior admin-app stage).
 */
describe("performSave", () => {
  it("create mode calls deps.create and returns the saved item", async () => {
    const created = makeItem("new-1", 0);
    const create = jest.fn().mockResolvedValue(created);

    const result = await performSave("create", null, { sortOrder: 0 }, { create });

    expect(create).toHaveBeenCalledWith({ sortOrder: 0 });
    expect(result).toEqual({ success: true, item: created });
  });

  it("edit mode calls deps.update with the id and returns the saved item", async () => {
    const updated = makeItem("item-1", 0);
    const update = jest.fn().mockResolvedValue(updated);

    const result = await performSave("edit", "item-1", { active: false }, { update });

    expect(update).toHaveBeenCalledWith("item-1", { active: false });
    expect(result).toEqual({ success: true, item: updated });
  });

  it("surfaces the backend's ApiError message on a failed save, not a generic one", async () => {
    const create = jest.fn().mockRejectedValue(new ApiError("دسته‌بندی نامعتبر است.", "BAD_REQUEST", 400));

    const result = await performSave("create", null, {}, { create });

    expect(result).toEqual({ success: false, message: "دسته‌بندی نامعتبر است." });
  });

  it("falls back to a generic Persian message for a non-ApiError failure (e.g. network error)", async () => {
    const create = jest.fn().mockRejectedValue(new Error("fetch failed"));

    const result = await performSave("create", null, {}, { create });

    expect(result).toEqual({ success: false, message: "ذخیره‌سازی با خطا مواجه شد." });
  });
});

describe("performToggleActive", () => {
  it("calls update with the flipped active value and returns the updated item", async () => {
    const updated = makeItem("item-1", 0, true);
    const update = jest.fn().mockResolvedValue(updated);

    const result = await performToggleActive("item-1", true, { update });

    expect(update).toHaveBeenCalledWith("item-1", { active: true });
    expect(result).toEqual({ success: true, item: updated });
  });

  it("returns a failure result (not a thrown error) when the backend rejects the toggle, e.g. a 403 for SUPPORT_VIEWER", async () => {
    const update = jest.fn().mockRejectedValue(new ApiError("Forbidden resource", "FORBIDDEN", 403));

    const result = await performToggleActive("item-1", false, { update });

    expect(result).toEqual({ success: false, message: "Forbidden resource" });
  });
});

describe("performReorder", () => {
  it("reorders then re-fetches the admin list, returning the refreshed items", async () => {
    const refreshedItems = [makeItem("b", 0), makeItem("a", 1)];
    const reorder = jest.fn().mockResolvedValue(undefined);
    const list = jest.fn().mockResolvedValue({ items: refreshedItems });

    const result = await performReorder([{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 1 }], { reorder, list });

    expect(reorder).toHaveBeenCalledWith([{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 1 }]);
    expect(list).toHaveBeenCalled();
    expect(result).toEqual({ success: true, items: refreshedItems });
  });

  it("a failed reorder call never re-fetches the list and never reports success", async () => {
    const reorder = jest.fn().mockRejectedValue(new ApiError("تغییر ترتیب با خطا مواجه شد.", "INTERNAL_ERROR", 500));
    const list = jest.fn();

    const result = await performReorder([{ id: "a", sortOrder: 0 }], { reorder, list });

    expect(result.success).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it("a failed re-fetch after a successful reorder also reports failure, not a false success", async () => {
    const reorder = jest.fn().mockResolvedValue(undefined);
    const list = jest.fn().mockRejectedValue(new Error("network down"));

    const result = await performReorder([{ id: "a", sortOrder: 0 }], { reorder, list });

    expect(result).toEqual({ success: false, message: "تغییر ترتیب با خطا مواجه شد." });
  });
});

describe("performRemove", () => {
  it("returns success on a successful delete", async () => {
    const remove = jest.fn().mockResolvedValue({ id: "item-1" });
    const result = await performRemove("item-1", { remove });
    expect(result).toEqual({ success: true });
  });

  it("surfaces a backend failure message rather than throwing", async () => {
    const remove = jest.fn().mockRejectedValue(new ApiError("امکان حذف وجود ندارد.", "BAD_REQUEST", 400));
    const result = await performRemove("item-1", { remove });
    expect(result).toEqual({ success: false, message: "امکان حذف وجود ندارد." });
  });
});

describe("moveItem", () => {
  const items = [makeItem("a", 0), makeItem("b", 1), makeItem("c", 2)];

  it("moving the second item up swaps it with the first and reassigns sequential sortOrder for the whole list", () => {
    const result = moveItem(items, 1, "up", (item) => item.id);
    expect(result).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("moving the second item down swaps it with the third", () => {
    const result = moveItem(items, 1, "down", (item) => item.id);
    expect(result).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("moving the first item up is a no-op that still returns the canonical sequential order", () => {
    const result = moveItem(items, 0, "up", (item) => item.id);
    expect(result).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("moving the last item down is a no-op that still returns the canonical sequential order", () => {
    const result = moveItem(items, 2, "down", (item) => item.id);
    expect(result).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });
});
