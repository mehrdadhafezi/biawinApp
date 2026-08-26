"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useHomeServiceBanners } from "./useHomeCms";
import type { HomeBannerTheme } from "../../lib/home-api";

/** `.service-banner.theme-*` overlay variables, re-read directly from the prototype's CSS this session (Stage 5.14 correction). React passes `--custom-property` keys straight through in the `style` object. */
const THEME_VARS: Record<HomeBannerTheme, Record<string, string>> = {
  auto: { "--ov1": "rgba(66,66,72,.10)", "--ov2": "rgba(22,22,26,.74)", "--ov3": "rgba(18,18,22,.90)" },
  home: { "--ov1": "rgba(141,110,99,.05)", "--ov2": "rgba(99,63,51,.70)", "--ov3": "rgba(84,53,43,.87)" },
  fashion: { "--ov1": "rgba(156,39,176,.05)", "--ov2": "rgba(106,27,154,.68)", "--ov3": "rgba(88,24,120,.85)" },
  gold: { "--ov1": "rgba(255,193,7,.04)", "--ov2": "rgba(176,127,18,.67)", "--ov3": "rgba(138,97,7,.84)" },
  travel: { "--ov1": "rgba(68,160,71,.06)", "--ov2": "rgba(28,94,32,.72)", "--ov3": "rgba(18,74,30,.88)" },
};

/**
 * `.services` (`#services`) — the featured-category banner grid, real
 * photos this time (Stage 5.13 correction — the first pass used a
 * themed gradient + emoji instead of the prototype's actual images).
 * Photos extracted from the prototype's inline base64 — see
 * docs/home-prototype-asset-map.md. Tiles link to the real
 * `/services/[categoryId]` route (Stage 9.1 shipped it).
 *
 * Stage 5.14 correction: every tile previously used one generic dark
 * vertical overlay. The prototype actually assigns a `.theme-*` class
 * per category (`--ov1/--ov2/--ov3` custom properties, re-verified
 * against the raw `<a class="service-banner theme-auto" data-category="اتومبیل">`
 * markup this session), and the wide "گردشگری" tile uses a *horizontal*
 * gradient (`90deg`), not the same vertical one — both re-added here.
 *
 * Stage 5.14.1 fix: the photo/overlay were rendering completely
 * invisible on live staging ("نزدیک به سفید"). Root cause: `img`/`:after`
 * use *negative* `z-index` (-2/-1) to sit behind the text, but
 * `.biawin-service-banner` itself never established its own stacking
 * context (`position:relative` alone, no `z-index`/`isolation`) — so
 * those negative-z-index layers escaped to the nearest ancestor that
 * *does* establish one (`AppShell`'s `translateZ(0)` wrapper, several
 * levels up, with an opaque white background), painting the photo
 * *underneath* every section's own background between here and there.
 * `isolation:isolate` (verified empirically on live staging — computed
 * `--ov1`/img both resolve correctly and the photo is visible again)
 * contains the negative-z-index children within this element's own
 * stacking context, matching the fix already present on
 * `BiawinCardsCarousel`'s `.biawin-credit-card` (which uses the same
 * negative-z-index trick for its decorative circles and was never
 * affected — this component just didn't have the same protection).
 */
export function ServiceBannerGrid() {
  const router = useRouter();
  const { banners } = useHomeServiceBanners();

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
        {banners.map((banner) => (
          <button
            key={banner.id}
            type="button"
            onClick={banner.categoryId ? () => router.push(`/services/${banner.categoryId}`) : undefined}
            className={`biawin-service-banner${banner.wide ? " biawin-service-banner--wide" : ""}`}
            style={THEME_VARS[banner.theme] as CSSProperties}
          >
            {banner.image && <img src={banner.image} alt={banner.categoryName} loading="lazy" />}
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
          display:flex;align-items:flex-end;cursor:pointer;box-sizing:border-box;isolation:isolate;
        }
        .biawin-service-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .5s ease}
        .biawin-service-banner:after{
          content:"";position:absolute;inset:0;z-index:-1;
          background:linear-gradient(180deg,var(--ov1) 8%,var(--ov2) 100%);
        }
        .biawin-service-banner:hover img{transform:scale(1.04)}
        .biawin-service-banner--wide{grid-column:1/-1;min-height:205px}
        .biawin-service-banner--wide:after{
          background:linear-gradient(90deg,var(--ov3) 0%,var(--ov2) 55%,rgba(255,255,255,0) 100%);
        }
        .biawin-service-banner-content{padding:16px;color:#fff;display:flex;align-items:center;justify-content:space-between;width:100%}
        .biawin-service-banner-content strong{display:block;font-size:15px}
        .biawin-service-banner--wide .biawin-service-banner-content strong{font-size:21px}
        .biawin-service-banner-content small{
          display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;
          background:rgba(255,255,255,.16);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
          width:max-content;font-size:11px;opacity:.85;margin-top:4px;
        }
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
