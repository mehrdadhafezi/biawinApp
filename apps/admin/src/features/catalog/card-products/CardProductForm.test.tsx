import { renderToStaticMarkup } from "react-dom/server";
import { CardProductForm } from "./CardProductForm";

jest.mock("../api/services-admin-api", () => ({
  servicesAdminApi: {
    list: jest.fn().mockResolvedValue({
      items: [{ id: "service-1", title: "بیمه شخص ثالث" }],
      total: 1,
      skip: 0,
      take: 100,
    }),
  },
}));

const baseCardProduct = {
  id: "card-1",
  serviceId: "service-1",
  service: { id: "service-1", title: "بیمه شخص ثالث" },
  title: "کارت اعتباری بیمه",
  subtitle: null,
  description: null,
  imageKey: null,
  mediaAssetId: null,
  image: null,
  badge: null,
  cardType: "CREDIT_CARD" as const,
  journeyType: "PURCHASE" as const,
  priceAmount: 5000000,
  priceLabel: null,
  valueAmount: 30000000,
  valueDisplayType: "UP_TO" as const,
  benefits: ["مزیت یک", "مزیت دو"],
  validityDays: 30,
  status: "DRAFT" as const,
  sortOrder: 0,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("CardProductForm rendering", () => {
  it("create mode renders the service selector, cardType/journeyType/status selects, and the priceAmount field", () => {
    const html = renderToStaticMarkup(
      <CardProductForm mode="create" backHref="/catalog/card-products" onSaved={jest.fn()} />,
    );

    expect(html).toContain("خدمت");
    expect(html).toContain("<select");
    expect(html).toContain("نوع کارت");
    expect(html).toContain("نوع مسیر کاربر");
    expect(html).toContain("مبلغ (ریال)");
    expect(html).toContain("وضعیت");
    expect(html).toContain("پیش‌نویس"); // DRAFT is the default status option
  });

  it("edit mode pre-fills price, benefits (comma-joined), and validity days from the existing card product", () => {
    const html = renderToStaticMarkup(
      <CardProductForm mode="edit" initial={baseCardProduct} backHref="/catalog/card-products" onSaved={jest.fn()} />,
    );

    expect(html).toContain("کارت اعتباری بیمه");
    expect(html).toContain('value="5000000"');
    expect(html).toContain("مزیت یک، مزیت دو");
    expect(html).toContain('value="30"');
  });

  it("edit mode pre-fills the card's displayed value/ceiling separately from priceAmount (SERVICES-R5.19)", () => {
    const html = renderToStaticMarkup(
      <CardProductForm mode="edit" initial={baseCardProduct} backHref="/catalog/card-products" onSaved={jest.fn()} />,
    );

    expect(html).toContain('value="30000000"');
    expect(html).toContain("ارزش/سقف کارت");
  });

  it("readOnly mode disables the fieldset and hides the submit control", () => {
    const html = renderToStaticMarkup(
      <CardProductForm mode="edit" initial={baseCardProduct} readOnly backHref="/catalog/card-products" onSaved={jest.fn()} />,
    );

    expect(html).toContain("دسترسی شما فقط مشاهده است");
  });
});
