import { renderToStaticMarkup } from "react-dom/server";
import { CategoryCardGrid } from "./CategoryCardGrid";
import type { CategoryCardDto } from "../../lib/services-api";

function categoryCard(overrides: Partial<CategoryCardDto> = {}): CategoryCardDto {
  return {
    id: "card-1",
    categoryId: "cat-1",
    targetServiceId: "svc-1",
    title: "کیف و کفش",
    subtitle: "انتخابی برای هر سلیقه",
    badge: null,
    image: null,
    highlights: [],
    sortOrder: 0,
    ...overrides,
  };
}

describe("CategoryCardGrid", () => {
  it("renders a skeleton grid while loading (categoryCards === null)", () => {
    const html = renderToStaticMarkup(<CategoryCardGrid categoryCards={null} error={null} onSelect={() => {}} />);
    expect(html).not.toContain("کیف و کفش");
  });

  it("renders the error state and never the empty state when both could apply", () => {
    const html = renderToStaticMarkup(<CategoryCardGrid categoryCards={[]} error="خطا در دریافت اطلاعات." onSelect={() => {}} />);
    expect(html).toContain("خطا در دریافت اطلاعات.");
    expect(html).not.toContain("ثبت نشده است");
  });

  it("renders a real, honest empty state when a Category genuinely has no discovery cards yet", () => {
    const html = renderToStaticMarkup(<CategoryCardGrid categoryCards={[]} error={null} onSelect={() => {}} />);
    expect(html).toContain("در حال حاضر کارتی برای این دسته‌بندی ثبت نشده است.");
  });

  it("renders real discovery cards when present", () => {
    const html = renderToStaticMarkup(
      <CategoryCardGrid categoryCards={[categoryCard()]} error={null} onSelect={() => {}} />,
    );
    expect(html).toContain("کیف و کفش");
    expect(html).toContain("مشاهده خدمت ←");
  });

  it("trusts the server-provided list as already active-only — never re-filters or hides a card the API returned", () => {
    const html = renderToStaticMarkup(
      <CategoryCardGrid categoryCards={[categoryCard()]} error={null} onSelect={() => {}} />,
    );
    expect(html).toContain("کیف و کفش");
  });
});
