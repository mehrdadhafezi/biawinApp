"use client";

import { useRouter } from "next/navigation";
import { SkeletonBlock } from "../common/SkeletonBlock";
import { SERVICE_BANNERS } from "./home.mock";
import type { CategoriesSummary } from "./useCategories";

/**
 * `.services` (`#services`) — the featured-category banner grid, real
 * photos this time (Stage 5.13 correction — the first pass used a
 * themed gradient + emoji instead of the prototype's actual images).
 * Photos extracted from the prototype's inline base64 — see
 * docs/home-prototype-asset-map.md. Tiles link to the real
 * `/services/[categoryId]` route (Stage 9.1 shipped it).
 */
export function ServiceBannerGrid({ categories, error }: CategoriesSummary) {
  const router = useRouter();
  if (error) return null;

  const banners = categories
    ? SERVICE_BANNERS.map((b) => ({ ...b, category: categories.find((c) => c.name === b.categoryName) })).filter((b) => b.category)
    : null;

  return (
    <section className="biawin-service-banner-section">
      <div className="biawin-service-banner-head">
        <div>
          <h3>خدمات منتخب بیاوین</h3>
          <p>خرید اقساطی در دسته‌بندی‌های پرکاربرد</p>
        </div>
        <a href="#top">بازگشت به بالا</a>
      </div>

      <div className="biawin-banner-grid">
        {banners === null
          ? [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={150} radiusPx={22} />)
          : banners.map((banner) => (
              <button
                key={banner.categoryName}
                type="button"
                onClick={() => router.push(`/services/${banner.category!.id}`)}
                className={`biawin-service-banner${banner.wide ? " biawin-service-banner--wide" : ""}`}
              >
                <img src={banner.image} alt={banner.categoryName} loading="lazy" />
                <div className="biawin-service-banner-content">
                  <div>
                    <strong>{banner.categoryName}</strong>
                    <small>{banner.kicker}</small>
                  </div>
                  <span className="biawin-arrow-circle">
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#fff" strokeWidth={2}>
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </span>
                </div>
              </button>
            ))}
      </div>

      <style>{`
        .biawin-service-banner-section{padding:34px 18px 48px;background:#f6faff}
        .biawin-service-banner-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px}
        .biawin-service-banner-head h3{margin:0;font-size:16px;font-weight:700}
        .biawin-service-banner-head p{margin:4px 0 0;font-size:11px;color:#6f8497}
        .biawin-service-banner-head a{font-size:11px;color:#0879dc;font-weight:700;text-decoration:none}

        .biawin-banner-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}
        .biawin-service-banner{
          all:unset;position:relative;overflow:hidden;border-radius:22px;min-height:150px;
          display:flex;align-items:flex-end;cursor:pointer;box-sizing:border-box;
        }
        .biawin-service-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .5s ease}
        .biawin-service-banner:after{
          content:"";position:absolute;inset:0;z-index:-1;
          background:linear-gradient(180deg,transparent 20%,rgba(2,30,56,.88) 100%);
        }
        .biawin-service-banner:hover img{transform:scale(1.04)}
        .biawin-service-banner--wide{grid-column:1/-1;min-height:205px}
        .biawin-service-banner-content{padding:16px;color:#fff;display:flex;align-items:center;justify-content:space-between;width:100%}
        .biawin-service-banner-content strong{display:block;font-size:15px}
        .biawin-service-banner--wide .biawin-service-banner-content strong{font-size:21px}
        .biawin-service-banner-content small{font-size:11px;opacity:.85}
        .biawin-arrow-circle{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;flex:0 0 auto}

        @media(max-width:620px){
          .biawin-service-banner-section{padding:28px 12px 40px}
          .biawin-banner-grid{gap:10px}
          .biawin-service-banner{min-height:155px;border-radius:19px}
          .biawin-service-banner--wide{min-height:190px}
          .biawin-service-banner--wide .biawin-service-banner-content strong{font-size:18px}
        }
      `}</style>
    </section>
  );
}
