import { formatCardProductValue } from "./cardProductPresentation";

/**
 * SERVICES-R5.19 — renamed from `formatCardProductPrice` and re-sourced
 * from `valueAmount`/`valueDisplayType` instead of `priceAmount`, which
 * R5.18 had incorrectly used to render the card's displayed value (see
 * docs/services-r5-19-purchase-order-audit.md §10). These tests assert
 * the corrected fields drive the display, and that `priceAmount` is
 * never consulted.
 */
describe("formatCardProductValue", () => {
  it("uses priceLabel verbatim when set, regardless of valueDisplayType", () => {
    expect(
      formatCardProductValue({ priceLabel: "برچسب سفارشی", valueAmount: 999999999, valueDisplayType: "FIXED" }),
    ).toBe("برچسب سفارشی");
  });

  it("renders a fixed amount for valueDisplayType FIXED — '30 میلیون تومان' style", () => {
    expect(
      formatCardProductValue({ priceLabel: null, valueAmount: 300000000, valueDisplayType: "FIXED" }),
    ).toBe("30,000,000 تومان");
  });

  it("renders a 'up to X credit' phrasing for valueDisplayType UP_TO — never a plain fixed amount", () => {
    expect(
      formatCardProductValue({ priceLabel: null, valueAmount: 300000000, valueDisplayType: "UP_TO" }),
    ).toBe("تا سقف 30,000,000 تومان اعتبار");
  });

  it("falls back to 'قیمت اعلام نشده' when neither priceLabel nor valueAmount is set", () => {
    expect(formatCardProductValue({ priceLabel: null, valueAmount: null, valueDisplayType: null })).toBe(
      "قیمت اعلام نشده",
    );
  });

  it("never produces a hardcoded literal — the amount is always derived from valueAmount", () => {
    const a = formatCardProductValue({ priceLabel: null, valueAmount: 1000000, valueDisplayType: "FIXED" });
    const b = formatCardProductValue({ priceLabel: null, valueAmount: 2000000, valueDisplayType: "FIXED" });
    expect(a).not.toBe(b);
    expect(a).toContain("100,000");
    expect(b).toContain("200,000");
  });

  it("NEVER reads priceAmount — a huge priceAmount with no valueAmount still falls back to 'قیمت اعلام نشده' (SERVICES-R5.19 CRITICAL MONETARY RULE)", () => {
    expect(
      formatCardProductValue({
        priceLabel: null,
        valueAmount: null,
        valueDisplayType: null,
        // @ts-expect-error -- priceAmount is not part of this function's parameter type; asserted here to prove it can't leak in even if present on the object.
        priceAmount: 999999999,
      }),
    ).toBe("قیمت اعلام نشده");
  });
});
