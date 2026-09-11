import { formatCardProductPrice, formatCardProductValue } from "./cardProductPresentation";

/**
 * SERVICES-R5.19 — renamed from `formatCardProductPrice` and re-sourced
 * from `valueAmount`/`valueDisplayType` instead of `priceAmount`, which
 * R5.18 had incorrectly used to render the card's displayed value (see
 * docs/services-r5-19-purchase-order-audit.md §10).
 *
 * SERVICES-R5.25 — a second conflation was found and fixed: this function
 * used to also read `priceLabel` as a value-display override, directly
 * contradicting the schema's own doc comment on that field (it overrides
 * `priceAmount`'s display, not `valueAmount`'s) — and, as a side effect,
 * `priceAmount`/`priceLabel` were never rendered anywhere in the customer
 * UI at all. `formatCardProductValue` no longer accepts `priceLabel`
 * (removed from its parameter type, not just untested); `formatCardProductPrice`
 * is the new, separate function for the price fact. See
 * docs/services-r5-25-services-prototype-finalization-audit.md.
 */
describe("formatCardProductValue", () => {
  it("renders a fixed amount for valueDisplayType FIXED — '30 میلیون تومان' style", () => {
    expect(formatCardProductValue({ valueAmount: 300000000, valueDisplayType: "FIXED" })).toBe(
      "30,000,000 تومان",
    );
  });

  it("renders a 'up to X credit' phrasing for valueDisplayType UP_TO — never a plain fixed amount", () => {
    expect(formatCardProductValue({ valueAmount: 300000000, valueDisplayType: "UP_TO" })).toBe(
      "تا سقف 30,000,000 تومان اعتبار",
    );
  });

  it("falls back to 'ارزش کارت مشخص نشده' when valueAmount is not set", () => {
    expect(formatCardProductValue({ valueAmount: null, valueDisplayType: null })).toBe(
      "ارزش کارت مشخص نشده",
    );
  });

  it("never produces a hardcoded literal — the amount is always derived from valueAmount", () => {
    const a = formatCardProductValue({ valueAmount: 1000000, valueDisplayType: "FIXED" });
    const b = formatCardProductValue({ valueAmount: 2000000, valueDisplayType: "FIXED" });
    expect(a).not.toBe(b);
    expect(a).toContain("100,000");
    expect(b).toContain("200,000");
  });

  it("NEVER reads priceAmount — a huge priceAmount with no valueAmount still falls back to 'ارزش کارت مشخص نشده' (SERVICES-R5.19 CRITICAL MONETARY RULE)", () => {
    expect(
      formatCardProductValue({
        valueAmount: null,
        valueDisplayType: null,
        // @ts-expect-error -- priceAmount is not part of this function's parameter type; asserted here to prove it can't leak in even if present on the object.
        priceAmount: 999999999,
      }),
    ).toBe("ارزش کارت مشخص نشده");
  });

  it("NEVER reads priceLabel either — a huge priceLabel override does not leak into the value display (SERVICES-R5.25)", () => {
    expect(
      formatCardProductValue({
        valueAmount: null,
        valueDisplayType: null,
        // @ts-expect-error -- priceLabel is not part of this function's parameter type; asserted here to prove the R5.19 conflation genuinely can't recur.
        priceLabel: "قیمت سفارشی",
      }),
    ).toBe("ارزش کارت مشخص نشده");
  });
});

/**
 * SERVICES-R5.25 — the amount the customer actually PAYS Biawin, the fact
 * `formatCardProductValue` above must never read. Mirrors `Pricing.tsx`'s
 * exact existing `Service.priceLabel` fallback convention.
 */
describe("formatCardProductPrice", () => {
  it("uses priceLabel verbatim when set", () => {
    expect(formatCardProductPrice({ priceLabel: "قیمت سفارشی", priceAmount: 999999999 })).toBe(
      "قیمت سفارشی",
    );
  });

  it("renders priceAmount as a formatted toman amount when priceLabel is unset (priceAmount is stored in Rial, displayed in Toman — formatToman divides by 10)", () => {
    expect(formatCardProductPrice({ priceLabel: null, priceAmount: 3000000 })).toBe("300,000 تومان");
  });

  it("falls back to 'قیمت اعلام نشده' when neither priceLabel nor priceAmount is set", () => {
    expect(formatCardProductPrice({ priceLabel: null, priceAmount: null })).toBe("قیمت اعلام نشده");
  });

  it("NEVER reads valueAmount — a huge valueAmount with no priceAmount still falls back to 'قیمت اعلام نشده'", () => {
    expect(
      formatCardProductPrice({
        priceLabel: null,
        priceAmount: null,
        // @ts-expect-error -- valueAmount is not part of this function's parameter type; asserted here to prove it can't leak in even if present on the object.
        valueAmount: 999999999,
      }),
    ).toBe("قیمت اعلام نشده");
  });
});
