import { renderToStaticMarkup } from "react-dom/server";
import { MethodFilterChips, matchesMethodFilter } from "./MethodFilterChips";

describe("MethodFilterChips", () => {
  it("renders exactly the 5 real chips (همه + the 4 real PurchaseMethod values) — never the prototype's unbacked تخفیفی/ترکیبی chips", () => {
    const html = renderToStaticMarkup(<MethodFilterChips value="all" onChange={() => {}} />);
    expect(html).toContain("همه");
    expect(html).toContain("اعتباری");
    expect(html).toContain("اقساطی");
    expect(html).toContain("پرداخت کامل");
    expect(html).toContain("رایگان");
    expect(html).not.toContain("تخفیفی");
    expect(html).not.toContain("ترکیبی");
    expect((html.match(/<button/g) ?? []).length).toBe(5);
  });

  it("marks the active chip with aria-pressed=true and every other chip false", () => {
    const html = renderToStaticMarkup(<MethodFilterChips value="credit" onChange={() => {}} />);
    expect(html).toContain('aria-pressed="true"');
    expect((html.match(/aria-pressed="false"/g) ?? []).length).toBe(4);
  });
});

describe("matchesMethodFilter", () => {
  it("matches everything when the filter is 'all'", () => {
    expect(matchesMethodFilter([], "all")).toBe(true);
    expect(matchesMethodFilter(["credit"], "all")).toBe(true);
  });

  it("matches only services that actually list the selected real method", () => {
    expect(matchesMethodFilter(["credit", "installment"], "credit")).toBe(true);
    expect(matchesMethodFilter(["credit", "installment"], "cash")).toBe(false);
    expect(matchesMethodFilter([], "free")).toBe(false);
  });
});
