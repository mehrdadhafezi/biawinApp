import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Stage 5.17-B artwork-preservation regression (static).
 *
 * Existing customer artwork lives in `card_products`, `category_cards`,
 * `categories` and `services` (`mediaAssetId`, `galleryMediaAssetIds`). Home
 * Admin code must never be able to write them. This scans the Home feature
 * and the Media Library sources (everything the Home screens and the shared
 * picker/media page can call) and asserts:
 *   1. no Catalog endpoint is referenced;
 *   2. Home code never imports Catalog code;
 *   3. every mutating `apiClient.*` call targets only `/admin/home/**`,
 *      `/admin/media/**` or admin auth — never a catalog resource.
 * The shared MediaPicker(Field/Modal) is allowed: it only creates/selects a
 * media id and hands it to its caller; each caller writes its own endpoint.
 */
const SRC = join(__dirname, "..", "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !full.includes("__tests__")) out.push(full);
  }
  return out;
}

const homeScopeDirs = [
  join(SRC, "features", "home"),
  join(SRC, "app", "home"),
  join(SRC, "app", "media"),
  join(SRC, "components", "media"),
  join(SRC, "lib", "media"),
];
const files = homeScopeDirs.flatMap((dir) => walk(dir)).map((file) => ({ file: relative(SRC, file), text: readFileSync(file, "utf8") }));

describe("Home Admin cannot write catalog artwork references", () => {
  it("scans a meaningful set of Home/Media source files", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(["/admin/card-products", "/admin/category-cards", "/admin/categories", "/admin/services"])("no Home/Media source calls %s", (endpoint) => {
    const offenders = files.filter((f) => f.text.split("\n").some((line) => line.includes(endpoint) && !line.trim().startsWith("*") && !line.trim().startsWith("//"))).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it("Home/Media code never imports Catalog feature code", () => {
    const offenders = files.filter((f) => /from\s+["'][^"']*features\/catalog/.test(f.text)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it("every mutating apiClient call in Home/Media targets only /admin/home/** or /admin/media/**", () => {
    const mutating = /apiClient\.(post|put|patch|delete|postFormData)\s*(?:<[^>]*>)?\(\s*([^,)]+)/g;
    const targets: string[] = [];
    for (const f of files) {
      for (const match of f.text.matchAll(mutating)) targets.push(`${f.file}: ${match[2].trim()}`);
    }
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      // Either a `basePath` from createHomeResourceApi (bound to /admin/home/*), or a literal /admin/media path.
      expect(target).toMatch(/basePath|\/admin\/media/);
    }
    const homeApiFiles = files.filter((f) => f.file.includes(join("features", "home", "api")));
    const bound = homeApiFiles.flatMap((f) => [...f.text.matchAll(/createHomeResourceApi<[^>]*>\(\s*"([^"]+)"/g)].map((m) => m[1]));
    expect(bound.sort()).toEqual(
      ["/admin/home/hero-cards", "/admin/home/news-articles", "/admin/home/service-banners", "/admin/home/service-mosaic-tiles"].sort(),
    );
  });

  it("the Media Library never writes anything but upload (create) and delete (guarded by the backend 409)", () => {
    const media = files.find((f) => f.file.endsWith(join("lib", "media", "media-api.ts")))!;
    const calls = [...media.text.matchAll(/apiClient\.(postFormData|post|put|patch|delete)/g)].map((m) => m[1]).sort();
    expect(calls).toEqual(["delete", "postFormData"]);
  });

  it("the shared media picker only reports a selected id/url to its caller — it performs no writes itself", () => {
    for (const name of ["MediaPickerField.tsx", "MediaPickerModal.tsx"]) {
      const f = files.find((x) => x.file.endsWith(name))!;
      expect(f.text).not.toMatch(/apiClient\.(post|put|patch|delete)/);
      expect(f.text).not.toMatch(/mediaApi\.(remove|upload)\(/); // upload happens inside MediaUploadForm, which creates a NEW asset only
    }
  });
});
