import { renderToStaticMarkup } from "react-dom/server";
import { NewsArticleForm } from "./NewsArticleForm";

const baseArticle = {
  id: "article-1",
  category: "معرفی بیاوین",
  image: "/media/news-01.webp",
  mediaAssetId: "media-1",
  kicker: "راهنمای عضویت",
  title: "بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟",
  lead: "متن مقدمه.",
  bodySlug: null,
  sortOrder: 0,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("NewsArticleForm rendering", () => {
  it("create mode renders the category/kicker/title/lead fields, the media picker, and an active checkbox", () => {
    const html = renderToStaticMarkup(<NewsArticleForm mode="create" backHref="/home/news" onSaved={jest.fn()} />);

    expect(html).toContain("دسته‌بندی خبر");
    expect(html).toContain("متن مقدمه");
    expect(html).toContain("تصویر خبر");
    expect(html).toContain("فعال");
  });

  it("edit mode pre-fills the existing article and shows its resolved image", () => {
    const html = renderToStaticMarkup(<NewsArticleForm mode="edit" initial={baseArticle} backHref="/home/news" onSaved={jest.fn()} />);

    expect(html).toContain("بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟");
    expect(html).toContain("/media/news-01.webp");
  });

  it("readOnly mode (SUPPORT_VIEWER) never renders a submit control", () => {
    const html = renderToStaticMarkup(
      <NewsArticleForm mode="edit" initial={baseArticle} readOnly backHref="/home/news" onSaved={jest.fn()} />,
    );

    expect(html).not.toContain('type="submit"');
  });
});
