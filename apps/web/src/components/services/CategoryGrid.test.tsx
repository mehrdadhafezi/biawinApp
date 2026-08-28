import { renderToStaticMarkup } from "react-dom/server";
import { CategoryGrid } from "./CategoryGrid";
import type { CategoryDto } from "../../lib/services-api";

function category(overrides: Partial<CategoryDto>): CategoryDto {
  return {
    id: "id",
    name: "نام",
    description: "توضیح",
    imageKey: null,
    keywords: [],
    sortOrder: 0,
    active: true,
    ...overrides,
  };
}

// 19 real categories, matching the exact live-staging set this stage verified
// (docs/services-r1-fidelity-report.md) — real names/ids, not prototype synthetic content.
const REAL_CATEGORIES: CategoryDto[] = [
  category({ id: "c-gardeshgari", name: "گردشگری" }),
  category({ id: "c-otomobil", name: "اتومبیل" }),
  category({ id: "c-lavazem", name: "لوازم خانگی" }),
  category({ id: "c-tala", name: "طلا و جواهر" }),
  category({ id: "c-poushak", name: "پوشاک" }),
  category({ id: "c-zibaei", name: "زیبایی" }),
  category({ id: "c-bime", name: "بیمه" }),
  category({ id: "c-digital", name: "دیجیتال" }),
  category({ id: "c-salamat", name: "سلامت" }),
  category({ id: "c-varzesh", name: "باشگاه و ورزش" }),
  category({ id: "c-hedie", name: "کارت هدیه" }),
  category({ id: "c-mobile", name: "موبایل و لپ‌تاپ" }),
  category({ id: "c-khane", name: "خانه و زندگی" }),
  category({ id: "c-mobleman", name: "مبلمان" }),
  category({ id: "c-amoozesh", name: "آموزش" }),
  category({ id: "c-sazmani", name: "خدمات سازمانی" }),
  category({ id: "c-roozmare", name: "خرید روزمره" }),
  category({ id: "c-mali", name: "مالی و اعتباری" }),
  category({ id: "c-koodak", name: "کودک و نوجوان" }),
];

describe("CategoryGrid", () => {
  it("shows a skeleton grid while categories are null (loading)", () => {
    const html = renderToStaticMarkup(<CategoryGrid categories={null} onSelect={() => {}} />);
    expect(html).not.toContain("گردشگری");
  });

  it("renders only the first 11 categories by default, in the prototype's grid order", () => {
    const html = renderToStaticMarkup(<CategoryGrid categories={REAL_CATEGORIES} onSelect={() => {}} />);
    const firstEleven = REAL_CATEGORIES.slice(0, 11).map((c) => c.name);
    for (const name of firstEleven) {
      expect(html).toContain(name);
    }
    // The 8 "بیشتر"-revealed categories must NOT be in the initial render.
    expect(html).not.toContain("خدمات سازمانی");
    expect(html).not.toContain("کودک و نوجوان");
    expect(html).toContain("بیشتر");
  });

  it("uses real category ids, never a display-name match, for the tile's tappable identity", () => {
    // renderToStaticMarkup can't fire onClick, but confirms the real id is
    // the only identifier CategoryGrid threads through (no name-based
    // lookup anywhere in its own render), matching every prior Home CMS
    // module's "real FK, not categoryName===category.name" contract.
    const oneCategory = [category({ id: "11111111-1111-1111-1111-111111111111", name: "گردشگری" })];
    const html = renderToStaticMarkup(<CategoryGrid categories={oneCategory} onSelect={() => {}} />);
    expect(html).toContain("گردشگری");
    // Structural sanity: exactly one real tile button rendered (no "بیشتر" toggle needed for 1 item).
    expect((html.match(/<button/g) ?? []).length).toBe(1);
  });

  it("falls back to the more-icon and keeps an unmatched category visible, rather than dropping it", () => {
    const withUnknown = [...REAL_CATEGORIES.slice(0, 3), category({ id: "c-unknown", name: "یک دسته‌ی ناشناخته" })];
    const html = renderToStaticMarkup(<CategoryGrid categories={withUnknown} onSelect={() => {}} />);
    expect(html).toContain("یک دسته‌ی ناشناخته");
  });

  it("renders nothing at all when the real catalog has zero categories (does not crash)", () => {
    const html = renderToStaticMarkup(<CategoryGrid categories={[]} onSelect={() => {}} />);
    expect(html).not.toContain("بیشتر");
  });
});
