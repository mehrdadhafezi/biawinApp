import { renderToStaticMarkup } from "react-dom/server";
import { HeroCardForm } from "./HeroCardForm";

jest.mock("../api/home-hero-api", () => ({
  homeHeroApi: {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }),
  },
}));

const baseCard = {
  id: "card-1",
  cardKey: "biawin" as const,
  label: "کارت اصلی",
  title: "کارت بیاوین",
  subtitle: "عضویت اصلی",
  displayNumber: "6219 8610 4432 1095",
  ownerLabel: "BIAWIN CLUB",
  colorPreset: "sky" as const,
  sortOrder: 1,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * `HomeHeroCard` has no MediaAsset relation and no link field in the real
 * Stage 5.19 model — confirms the form deliberately never renders a media
 * picker or link input (would be inventing fields not in the backend
 * contract).
 */
describe("HeroCardForm rendering", () => {
  it("create mode renders the required fields, no media picker, and a submit button", () => {
    const html = renderToStaticMarkup(<HeroCardForm mode="create" backHref="/home/hero-cards" onSaved={jest.fn()} />);

    expect(html).toContain("کلید کارت");
    expect(html).toContain("برچسب");
    expect(html).toContain("زیرعنوان");
    expect(html).toContain("شماره نمایشی");
    expect(html).toContain("برچسب صاحب کارت");
    expect(html).toContain("پیش‌فرض رنگ");
    expect(html).not.toContain("انتخاب تصویر");
    expect(html).toContain("ذخیره");
  });

  it("edit mode pre-fills the existing card's values", () => {
    const html = renderToStaticMarkup(
      <HeroCardForm mode="edit" initial={baseCard} backHref="/home/hero-cards" onSaved={jest.fn()} />,
    );

    expect(html).toContain("کارت بیاوین");
    expect(html).toContain("BIAWIN CLUB");
  });

  it("readOnly mode (SUPPORT_VIEWER) shows the values but no submit button", () => {
    const html = renderToStaticMarkup(
      <HeroCardForm mode="edit" initial={baseCard} readOnly backHref="/home/hero-cards" onSaved={jest.fn()} />,
    );

    expect(html).toContain("دسترسی شما فقط مشاهده است");
    expect(html).not.toContain(">ذخیره<");
    expect(html).toContain("انصراف");
  });
});
