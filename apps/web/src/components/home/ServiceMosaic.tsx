"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriesSummary } from "./useCategories";

const HALF_TILES = [
  { categoryName: "زیبایی", icon: "💄", kicker: "زیبایی و مراقبت", gradient: "linear-gradient(160deg,#ff6b95,#b02b5c)" },
  { categoryName: "بیمه", icon: "🛡", kicker: "آرامش بیشتر", gradient: "linear-gradient(160deg,#2196f3,#0d47a1)" },
];

const WIDE_SLIDES = [
  { categoryName: "مبلمان", icon: "🛋", kicker: "خانه و زندگی", title: "مبلمان و دکوراسیون", lead: "خرید منعطف برای خانه‌ای کامل‌تر", gradient: "linear-gradient(160deg,#8d6e63,#54352b)" },
  { categoryName: "دیجیتال", icon: "📱", kicker: "انتخاب هوشمند", title: "کالای دیجیتال", lead: "گوشی، لپ‌تاپ و لوازم کاربردی", gradient: "linear-gradient(160deg,#3f51b5,#1e2d78)" },
];

/**
 * `.sketch-continuation` — the 2-half-tile + auto-rotating wide-slide
 * mosaic, pixel-matched to the prototype. Same real-category-by-name +
 * gradient-fallback + real `/services/[categoryId]` link approach as
 * `ServiceBannerGrid`.
 */
export function ServiceMosaic({ categories, error }: CategoriesSummary) {
  const router = useRouter();
  const [wideIndex, setWideIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setWideIndex((i) => (i + 1) % WIDE_SLIDES.length), 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (error) return null;

  function categoryId(name: string) {
    return categories?.find((c) => c.name === name)?.id ?? null;
  }

  function goToCategory(name: string) {
    const id = categoryId(name);
    if (id) router.push(`/services/${id}`);
  }

  return (
    <section style={{ padding: "8px 18px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        {HALF_TILES.map((tile) => (
          <button
            key={tile.categoryName}
            type="button"
            onClick={() => goToCategory(tile.categoryName)}
            style={{ all: "unset", height: 154, borderRadius: 25, position: "relative", overflow: "hidden", cursor: "pointer", background: tile.gradient, boxShadow: "0 13px 30px rgba(5,73,136,.13)" }}
          >
            <span aria-hidden="true" style={{ position: "absolute", top: 14, left: 14, fontSize: 30, opacity: 0.5 }}>
              {tile.icon}
            </span>
            <span style={{ position: "absolute", zIndex: 2, right: 14, left: 14, bottom: 14, color: "#fff" }}>
              <small style={{ display: "block", fontSize: 10, marginBottom: 4, opacity: 0.9 }}>{tile.kicker}</small>
              <strong style={{ display: "block", fontSize: 17, lineHeight: 1.55 }}>{tile.categoryName}</strong>
            </span>
          </button>
        ))}

        <div style={{ gridColumn: "1/-1", height: 184, position: "relative", borderRadius: 25, overflow: "hidden", boxShadow: "0 13px 30px rgba(5,73,136,.13)" }}>
          {WIDE_SLIDES.map((slide, i) => (
            <button
              key={slide.categoryName}
              type="button"
              onClick={() => goToCategory(slide.categoryName)}
              style={{
                all: "unset",
                position: "absolute",
                inset: 0,
                cursor: "pointer",
                background: slide.gradient,
                opacity: i === wideIndex ? 1 : 0,
                pointerEvents: i === wideIndex ? "auto" : "none",
                transition: "opacity .45s ease",
              }}
            >
              <span aria-hidden="true" style={{ position: "absolute", top: 16, left: 16, fontSize: 36, opacity: 0.5 }}>
                {slide.icon}
              </span>
              <span style={{ position: "absolute", zIndex: 2, right: 14, left: 14, bottom: 14, color: "#fff" }}>
                <small style={{ display: "block", fontSize: 10, marginBottom: 4, opacity: 0.9 }}>{slide.kicker}</small>
                <strong style={{ display: "block", fontSize: 17, lineHeight: 1.55 }}>{slide.title}</strong>
                <em style={{ display: "block", fontSize: 10, fontStyle: "normal", marginTop: 4, opacity: 0.92 }}>{slide.lead}</em>
              </span>
            </button>
          ))}
          <div aria-label="اسلایدهای خدمات" style={{ position: "absolute", zIndex: 5, left: 16, bottom: 14, display: "flex", gap: 6 }}>
            {WIDE_SLIDES.map((slide, i) => (
              <button
                key={slide.categoryName}
                type="button"
                aria-label={slide.categoryName}
                onClick={() => setWideIndex(i)}
                style={{ width: i === wideIndex ? 22 : 7, height: 7, borderRadius: 999, background: i === wideIndex ? "#fff" : "rgba(255,255,255,.48)", border: 0, padding: 0, cursor: "pointer", transition: ".2s" }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
