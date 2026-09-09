import { formatCardProductPrice } from "./cardProductPresentation";

describe("formatCardProductPrice", () => {
  it("uses priceLabel verbatim when set, regardless of cardType", () => {
    expect(
      formatCardProductPrice({ priceLabel: "برچسب سفارشی", priceAmount: 999999999, cardType: "VOUCHER" }),
    ).toBe("برچسب سفارشی");
  });

  it("renders a fixed amount for a non-credit card type (e.g. VOUCHER) — '30 میلیون تومان' style", () => {
    expect(
      formatCardProductPrice({ priceLabel: null, priceAmount: 300000000, cardType: "VOUCHER" }),
    ).toBe("30,000,000 تومان");
  });

  it("renders a 'up to X credit' phrasing for CREDIT_CARD — never a plain fixed amount", () => {
    expect(
      formatCardProductPrice({ priceLabel: null, priceAmount: 300000000, cardType: "CREDIT_CARD" }),
    ).toBe("تا سقف 30,000,000 تومان اعتبار");
  });

  it("falls back to 'قیمت اعلام نشده' when neither priceLabel nor priceAmount is set", () => {
    expect(formatCardProductPrice({ priceLabel: null, priceAmount: null, cardType: "SUBSCRIPTION" })).toBe(
      "قیمت اعلام نشده",
    );
  });

  it("never produces a hardcoded literal — the amount is always derived from priceAmount", () => {
    const a = formatCardProductPrice({ priceLabel: null, priceAmount: 1000000, cardType: "DISCOUNT_CARD" });
    const b = formatCardProductPrice({ priceLabel: null, priceAmount: 2000000, cardType: "DISCOUNT_CARD" });
    expect(a).not.toBe(b);
    expect(a).toContain("100,000");
    expect(b).toContain("200,000");
  });
});
