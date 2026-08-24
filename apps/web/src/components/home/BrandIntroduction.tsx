import { color } from "@biawin/ui";

/** `.intro` — static brand message, verbatim prototype copy. */
export function BrandIntroduction() {
  return (
    <section style={{ textAlign: "center", padding: "24px 22px 18px", background: "#fff" }}>
      <div style={{ fontSize: 11, color: color.primary, fontWeight: 700, marginBottom: 5 }}>باشگاه هوشمند تجربه‌های ارزشمند</div>
      <h2 style={{ margin: 0, fontSize: 25, fontWeight: 800, color: color.deep, letterSpacing: "-.8px" }}>بیاوین</h2>
      <p style={{ margin: "7px auto 0", maxWidth: 440, color: color.muted, fontSize: 13, lineHeight: 1.9 }}>
        راهی ساده‌تر برای خریدهای بزرگ اقساطی، دریافت اعتبار و استفاده از خدمات منتخب.
      </p>
    </section>
  );
}
