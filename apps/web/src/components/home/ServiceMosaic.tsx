"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_MOSAIC_HALVES, SERVICE_MOSAIC_WIDE } from "./home.mock";
import type { CategoriesSummary } from "./useCategories";

/**
 * `.sketch-continuation` — the 2-half-tile + auto-rotating wide-slide
 * mosaic, real photos this time (Stage 5.13 correction — the first pass
 * used gradients + emoji instead of the prototype's actual images,
 * extracted this session — see docs/home-prototype-asset-map.md). Same
 * real-category-by-name + real `/services/[categoryId]` link approach
 * as `ServiceBannerGrid`.
 */
export function ServiceMosaic({ categories, error }: CategoriesSummary) {
  const router = useRouter();
  const [wideIndex, setWideIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setWideIndex((i) => (i + 1) % SERVICE_MOSAIC_WIDE.length), 5000);
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
    <section className="biawin-sketch-continuation">
      <div className="biawin-service-mosaic">
        {SERVICE_MOSAIC_HALVES.map((tile) => (
          <button
            key={tile.categoryName}
            type="button"
            onClick={() => goToCategory(tile.categoryName)}
            className="biawin-service-mosaic-card biawin-service-mosaic-card--half"
          >
            <img src={tile.image} alt={tile.categoryName} loading="lazy" />
            <span className="biawin-service-mosaic-shade" />
            <span className="biawin-service-mosaic-copy">
              <small>{tile.kicker}</small>
              <strong>{tile.categoryName}</strong>
            </span>
          </button>
        ))}

        <div className="biawin-service-wide-slider">
          {SERVICE_MOSAIC_WIDE.map((slide, i) => (
            <button
              key={slide.categoryName}
              type="button"
              onClick={() => goToCategory(slide.categoryName)}
              className={`biawin-service-wide-slide${i === wideIndex ? " biawin-service-wide-slide--active" : ""}`}
            >
              <img src={slide.image} alt={slide.categoryName} loading="lazy" />
              <span className="biawin-service-mosaic-shade" />
              <span className="biawin-service-mosaic-copy">
                <small>{slide.kicker}</small>
                <strong>{slide.title}</strong>
                <em>{slide.lead}</em>
              </span>
            </button>
          ))}
          <div aria-label="اسلایدهای خدمات" className="biawin-service-wide-dots">
            {SERVICE_MOSAIC_WIDE.map((slide, i) => (
              <button
                key={slide.categoryName}
                type="button"
                aria-label={slide.categoryName}
                onClick={() => setWideIndex(i)}
                className={i === wideIndex ? "biawin-active" : ""}
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
        .biawin-service-mosaic-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,35,72,.05),rgba(3,43,85,.82))}
        .biawin-service-mosaic-copy{position:absolute;z-index:2;right:14px;left:14px;bottom:14px;color:#fff}
        .biawin-service-mosaic-copy small{display:block;font-size:10px;margin-bottom:4px;opacity:.9}
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
