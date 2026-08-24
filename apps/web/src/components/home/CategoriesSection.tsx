"use client";

import { useRouter } from "next/navigation";
import { CATEGORY_TICKER_DOWN, CATEGORY_TICKER_ICON, CATEGORY_TICKER_UP } from "./home.mock";

/**
 * `.categories.credit-power-section` — the two-column auto-scrolling
 * category ticker ("قدرت اعتبار در باشگاه"), pixel-matched to the
 * prototype. Temporary mock category names/icons (no `imageUrl`
 * resolution exists for `Category.imageKey` yet — docs/services-ui-contract.md
 * §6 Gap #3); "مشاهده همه خدمات" is a real link to the now-shipped
 * `/services` browse page (Stage 9.1), not a placeholder.
 */
export function CategoriesSection() {
  const router = useRouter();

  return (
    <section
      aria-label="قدرت اعتبار در باشگاه"
      style={{ padding: "26px 18px", background: "linear-gradient(145deg,#075ba9 0%,#0879dc 58%,#36a1ee 100%)", position: "relative", overflow: "hidden" }}
    >
      <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "minmax(134px,.82fr) minmax(0,1.18fr)", gap: 16, alignItems: "center", direction: "rtl" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, height: "calc((88px * 4) + (10px * 3))", overflow: "hidden", position: "relative", padding: "4px 6px" }}>
          <TickerColumn items={CATEGORY_TICKER_UP} direction="up" />
          <TickerColumn items={CATEGORY_TICKER_DOWN} direction="down" />
        </div>

        <div style={{ paddingRight: 16, borderRight: "1px solid rgba(255,255,255,.25)", textAlign: "right" }}>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.13)", fontSize: 9, fontWeight: 700, opacity: 0.95, color: "#fff" }}>
            قدرت اعتبار در باشگاه
          </span>
          <h3 style={{ fontSize: 16, lineHeight: 1.8, margin: "8px 0", fontWeight: 500, color: "#fff" }}>
            هر یک میلیون تومان در بیاوین <b style={{ display: "block", fontSize: 24, lineHeight: 1.4, fontWeight: 900 }}>۴ میلیون</b> کار می‌کند
          </h3>
          <p style={{ fontSize: 9, lineHeight: 1.9, opacity: 0.82, margin: "0 0 10px", maxWidth: 330, color: "#fff" }}>
            دو ستون خدمات به‌صورت پیوسته بالا و پایین حرکت می‌کنند تا همه دسته‌بندی‌های بیاوین را یکجا ببینید.
          </p>
          <button
            type="button"
            onClick={() => router.push("/services")}
            style={{
              height: 38,
              padding: "0 12px",
              borderRadius: 12,
              border: 0,
              background: "#fff",
              color: "#0879dc",
              fontSize: 10,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            مشاهده همه خدمات
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes biawinTickerUp{from{transform:translateY(0)}to{transform:translateY(calc(-50% - 5px))}}
        @keyframes biawinTickerDown{from{transform:translateY(calc(-50% - 5px))}to{transform:translateY(0)}}
        .biawin-ticker-col{position:relative;min-width:0;overflow:hidden;border-radius:999px}
        .biawin-ticker-track{display:flex;flex-direction:column;gap:10px}
        .biawin-ticker-track--up{animation:biawinTickerUp 28s linear infinite}
        .biawin-ticker-track--down{animation:biawinTickerDown 31s linear infinite}
        .biawin-ticker-col:hover .biawin-ticker-track{animation-play-state:paused}
        @media(prefers-reduced-motion:reduce){.biawin-ticker-track{animation:none!important}}
      `}</style>
    </section>
  );
}

function TickerColumn({ items, direction }: { items: readonly string[]; direction: "up" | "down" }) {
  return (
    <div className="biawin-ticker-col">
      <div
        aria-hidden={direction === "down"}
        className={`biawin-ticker-track biawin-ticker-track--${direction}`}
      >
        {[...items, ...items].map((name, i) => (
          <div
            key={`${name}-${i}`}
            aria-hidden={i >= items.length}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              width: "100%",
              height: 88,
              justifyContent: "center",
              background: "rgba(255,255,255,.1)",
              borderRadius: 16,
              color: "#fff",
            }}
          >
            <span style={{ fontSize: 22 }} aria-hidden="true">
              {CATEGORY_TICKER_ICON[name] ?? "🛍️"}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700 }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
