import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Stage 5.17-B: guards the wiring that keeps the four Home lists from
 * staying stale after a failed mutation. There is no DOM test library in
 * this app (see jest.config.js), so the behavior itself is covered by the
 * `stale` flag tests in `logic-hardening.test.ts`; this asserts every list
 * screen actually acts on that flag (refetches, and closes the delete dialog
 * for an already-deleted row) instead of only showing the message.
 */
const HOME = join(__dirname, "..");
const LISTS = [
  "hero/HeroCardsListContent.tsx",
  "service-banners/ServiceBannersListContent.tsx",
  "service-mosaic/ServiceMosaicListContent.tsx",
  "news/NewsListContent.tsx",
];

describe.each(LISTS)("%s", (file) => {
  const text = readFileSync(join(HOME, file), "utf8");

  it("refetches the list when a toggle or reorder failure is stale", () => {
    expect(text.match(/if \(result\.stale\) void load\(\);/g)?.length).toBe(2);
  });

  it("closes the delete dialog, reports the message and refetches when the row was already deleted", () => {
    expect(text).toContain("} else if (result.stale) {");
    expect(text).toMatch(/setDeleteTarget\(null\);\s*setDeleteError\(null\);\s*setActionError\(result\.message\);\s*void load\(\);/);
  });

  it("never marks a failed delete as removed (the local filter only runs on success)", () => {
    const successBranch = text.slice(text.indexOf("if (result.success) {", text.indexOf("handleConfirmDelete")));
    expect(successBranch.indexOf("filter((entry) => entry.id !== deleteTarget.id)")).toBeGreaterThan(-1);
    expect(successBranch.indexOf("filter((entry) => entry.id !== deleteTarget.id)")).toBeLessThan(successBranch.indexOf("else if (result.stale)"));
  });
});
