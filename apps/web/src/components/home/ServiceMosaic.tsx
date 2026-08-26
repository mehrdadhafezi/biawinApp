"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHomeServiceMosaic } from "./useHomeCms";
import type { HomeMosaicTheme } from "../../lib/home-api";

/** `.service-mosaic-card.theme-*`/`.service-wide-slide.theme-*` overlay variables, re-read directly from the prototype's CSS this session (Stage 5.14 correction — the first pass had one flat overlay for every tile). */
const THEME_VARS: Record<HomeMosaicTheme, CSSProperties> = {
  beauty: { "--ov1": "rgba(255,107,149,.05)", "--ov2": "rgba(214,51,108,.67)" } as CSSProperties,
  insurance: { "--ov1": "rgba(33,150,243,.05)", "--ov2": "rgba(21,101,192,.67)" } as CSSProperties,
  home: { "--ov1": "rgba(141,110,99,.05)", "--ov2": "rgba(99,63,51,.70)" } as CSSProperties,
  digital: { "--ov1": "rgba(63,81,181,.05)", "--ov2": "rgba(48,63,159,.68)" } as CSSProperties,
};

/**
 * `.sketch-continuation` — the 2-half-tile + auto-rotating wide-slide
 * mosaic, real photos this time (Stage 5.13 correction — the first pass
 * used gradients + emoji instead of the prototype's actual images,
 * extracted this session — see docs/home-prototype-asset-map.md). Same
 * real-category-by-name + real `/services/[categoryId]` link approach
 * as `ServiceBannerGrid`. Stage 5.14 correction: per-category
 * `.theme-*` overlay tint re-added (same class of bug `ServiceBannerGrid`
 * had — one generic overlay instead of the prototype's per-category one).
 */
export function ServiceMosaic() {
  const router = useRouter();
  const { halves, wide } = useHomeServiceMosaic();
  const [wideIndex, setWideIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Clamped at render time (not reset via a separate effect) so a change in
  // `wide.length` between the static fallback and the live CMS result (or
  // any future Admin edit) never leaves `wideIndex` pointing past the end —
  // every slide would render inactive (opacity 0) until the interval's next
  // tick otherwise.
  const activeWideIndex = wide.length > 0 ? wideIndex % wide.length : 0;

  useEffect(() => {
    if (wide.length === 0) return;
    timerRef.current = setInterval(() => setWideIndex((i) => (i + 1) % wide.length), 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [wide.length]);

  function goToCategory(categoryId: string | null) {
    if (categoryId) router.push(`/services/${categoryId}`);
  }

  return (
    <section className="biawin-sketch-continuation">
      <div className="biawin-service-mosaic">
        {halves.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => goToCategory(tile.categoryId)}
            className="biawin-service-mosaic-card biawin-service-mosaic-card--half"
            style={THEME_VARS[tile.theme]}
          >
            {tile.image && <img src={tile.image} alt={tile.categoryName} loading="lazy" />}
            <span className="biawin-service-mosaic-shade" />
            <span className="biawin-service-mosaic-copy">
              <small>{tile.kicker}</small>
              <strong>{tile.categoryName}</strong>
            </span>
          </button>
        ))}

        <div className="biawin-service-wide-slider">
          {wide.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goToCategory(slide.categoryId)}
              className={`biawin-service-wide-slide${i === activeWideIndex ? " biawin-service-wide-slide--active" : ""}`}
              style={THEME_VARS[slide.theme]}
            >
              {slide.image && <img src={slide.image} alt={slide.categoryName} loading="lazy" />}
              <span className="biawin-service-mosaic-shade" />
              <span className="biawin-service-mosaic-copy">
                <small>{slide.kicker}</small>
                <strong>{slide.title}</strong>
                <em>{slide.lead}</em>
              </span>
            </button>
          ))}
          <div aria-label="اسلایدهای خدمات" className="biawin-service-wide-dots">
            {wide.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={slide.categoryName}
                onClick={() => setWideIndex(i)}
                className={i === activeWideIndex ? "biawin-active" : ""}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .biawin-sketch-continuation{padding:8px 18px 0}
        .biawin-service-mosaic{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .biawin-service-mosaic-card,.biawin-service-wide-slide{
          all:unset;position:relative;overflow:hidden;border-radius:25px;display:block;
          background:#dceeff;box-shadow:0 13px 30px rgba(5,73,136,.13);cursor:pointer;box-sizing:border-box;
        }
        .biawin-service-mosaic-card--half{height:154px}
        .biawin-service-mosaic-card img,.biawin-service-wide-slide img{
          position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .45s ease;
        }
        .biawin-service-mosaic-card:hover img,.biawin-service-wide-slide:hover img{transform:scale(1.04)}
        .biawin-service-mosaic-shade{position:absolute;inset:0;background:linear-gradient(180deg,var(--ov1) 8%,var(--ov2) 100%)}
        .biawin-service-mosaic-copy{position:absolute;z-index:2;right:14px;left:14px;bottom:14px;color:#fff}
        .biawin-service-mosaic-copy small{
          display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;
          background:rgba(255,255,255,.16);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
          width:max-content;font-size:10px;margin-bottom:8px;opacity:.9;
        }
        .biawin-service-mosaic-copy strong{display:block;font-size:17px;line-height:1.55}
        .biawin-service-mosaic-copy em{display:block;font-size:10px;font-style:normal;margin-top:4px;opacity:.92}
        .biawin-service-wide-slider{grid-column:1/-1;height:184px;position:relative;border-radius:25px;overflow:hidden;box-shadow:0 13px 30px rgba(5,73,136,.13)}
        .biawin-service-wide-slide{position:absolute;inset:0;border-radius:0;opacity:0;pointer-events:none;transition:opacity .45s ease}
        .biawin-service-wide-slide--active{opacity:1;pointer-events:auto}
        .biawin-service-wide-dots{position:absolute;z-index:5;left:16px;bottom:14px;display:flex;gap:6px}
        .biawin-service-wide-dots button{all:unset;width:7px;height:7px;border-radius:999px;background:rgba(255,255,255,.48);cursor:pointer}
        .biawin-service-wide-dots button.biawin-active{width:22px;background:#fff}

        @media(max-width:620px){
          .biawin-sketch-continuation{padding-inline:12px}
          .biawin-service-mosaic{gap:10px}
          .biawin-service-mosaic-card--half{height:132px;border-radius:21px}
          .biawin-service-wide-slider{height:160px;border-radius:21px}
          .biawin-service-mosaic-copy strong{font-size:15px}
        }
      `}</style>
    </section>
  );
}
