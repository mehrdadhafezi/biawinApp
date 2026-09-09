import { renderToStaticMarkup } from "react-dom/server";
import { ServiceForm } from "./ServiceForm";
import type { PurchaseMethod } from "../types";

jest.mock("../../home/api/categories-api", () => ({
  categoriesApi: {
    listActive: jest.fn().mockResolvedValue([
      { id: "cat-1", name: "اتومبیل", active: true },
      { id: "cat-2", name: "لوازم خانگی", active: true },
    ]),
  },
}));

const baseService = {
  id: "service-1",
  categoryId: "cat-1",
  category: { id: "cat-1", name: "اتومبیل" },
  merchantId: null,
  title: "بیمه شخص ثالث",
  groupLabel: "بیمه",
  subtitle: "پوشش کامل خودرو",
  badge: "پرفروش",
  icon: "🚗",
  imageKey: null,
  priceFrom: 5000000,
  priceLabel: "از ۵ میلیون تومان",
  availableMethods: ["cash", "credit"] as PurchaseMethod[],
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * No `journeyType` field is asserted anywhere here — SERVICES-R5.16
 * decided journey type belongs on CardProduct, not Service (see
 * ServiceForm's own doc comment). This test proves the absence as much
 * as the presence of the real fields.
 */
describe("ServiceForm rendering", () => {
  it("create mode renders the category selector, core fields, and all 4 purchase-method checkboxes — no journeyType field", () => {
    const html = renderToStaticMarkup(<ServiceForm mode="create" backHref="/catalog/services" onSaved={jest.fn()} />);

    expect(html).toContain("دسته‌بندی");
    expect(html).toContain("<select");
    expect(html).toContain("عنوان");
    expect(html).toContain("برچسب گروه");
    expect(html).toContain("زیرعنوان");
    expect(html).toContain("نشان (badge)");
    expect(html).toContain("پرداخت کامل");
    expect(html).toContain("اعتباری");
    expect(html).toContain("اقساطی");
    expect(html).toContain("رایگان");
    expect(html).not.toContain("journeyType");
    expect(html).not.toContain("مسیر کاربر");
  });

  it("edit mode pre-checks the service's already-supported purchase methods", () => {
    const html = renderToStaticMarkup(
      <ServiceForm mode="edit" initial={baseService} backHref="/catalog/services" onSaved={jest.fn()} />,
    );

    expect(html).toContain("بیمه شخص ثالث");
    expect(html).toContain("value=\"5000000\"");
  });

  it("readOnly mode disables the fieldset and hides the submit control", () => {
    const html = renderToStaticMarkup(
      <ServiceForm mode="edit" initial={baseService} readOnly backHref="/catalog/services" onSaved={jest.fn()} />,
    );

    expect(html).toContain("دسترسی شما فقط مشاهده است");
  });
});
