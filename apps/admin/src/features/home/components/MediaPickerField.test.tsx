import { renderToStaticMarkup } from "react-dom/server";
import { MediaPickerField } from "./MediaPickerField";

/**
 * Stage 5.20 §18: the seeded Home CMS content may have no MediaAsset linked
 * yet — the field must show an explicit "no image selected" state, never a
 * silently substituted placeholder image.
 */
describe("MediaPickerField rendering", () => {
  it("shows 'تصویری انتخاب نشده است' and an 'انتخاب تصویر' button when no MediaAsset is selected", () => {
    const html = renderToStaticMarkup(<MediaPickerField label="تصویر" value={null} previewUrl={null} onChange={jest.fn()} />);

    expect(html).toContain("تصویری انتخاب نشده است");
    expect(html).toContain("انتخاب تصویر");
    expect(html).not.toContain("حذف انتخاب");
  });

  it("shows the resolved preview image and a 'تغییر تصویر' / 'حذف انتخاب' pair when one is selected", () => {
    const html = renderToStaticMarkup(
      <MediaPickerField label="تصویر" value="media-1" previewUrl="/media/example.webp" onChange={jest.fn()} />,
    );

    expect(html).toContain("/media/example.webp");
    expect(html).toContain("تغییر تصویر");
    expect(html).toContain("حذف انتخاب");
  });
});
