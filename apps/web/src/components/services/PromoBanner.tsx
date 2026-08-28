import { radius } from "@biawin/ui";

/**
 * Services List's promo banner — real migrated prototype asset
 * (`.promo-box img`, `alt="هر یک میلیون تومان در بیاوین ۳ میلیون کار
 * می‌کند"`). Purely decorative marketing copy baked into the image itself
 * in the prototype — no per-category data attached, so it's treated as a
 * static asset here (SERVICES-R1 scope; see
 * docs/services-r1-fidelity-report.md for the Admin-ownership question
 * this leaves open for a future stage).
 */
export function PromoBanner() {
  return (
    <img
      src="/services/promo-banner.webp"
      alt="هر یک میلیون تومان در بیاوین ۳ میلیون کار می‌کند"
      style={{ width: "100%", height: "auto", display: "block", borderRadius: radius.xl }}
    />
  );
}
