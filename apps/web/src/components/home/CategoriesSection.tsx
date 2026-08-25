"use client";

import { useRouter } from "next/navigation";
import { color } from "@biawin/ui";
import { CATEGORY_TICKER_DOWN, CATEGORY_TICKER_IMAGE, CATEGORY_TICKER_UP } from "./home.mock";

/**
 * `.categories.credit-power-section` — the two-column auto-scrolling
 * category ticker ("قدرت اعتبار در باشگاه"), rebuilt from the prototype's
 * exact CSS this session (Stage 5.13 correction — the first pass invented
 * rectangular tiles with emoji; the real prototype is transparent-
 * background circular photo items, `.credit-service-item`/
 * `.credit-service-photo`/`.credit-service-name`, re-read directly from
 * the source this time, not from the earlier wrong implementation).
 * Real photos extracted from the prototype's own inline images — see
 * docs/home-prototype-asset-map.md — not emoji. "مشاهده همه خدمات" is a
 * real link to the now-shipped `/services` browse page (Stage 9.1).
 */
export function CategoriesSection() {
  const router = useRouter();

  return (
    <section aria-label="قدرت اعتبار در باشگاه" className="biawin-credit-power-section">
      <div className="biawin-credit-power-shell">
        <div aria-label="همه خدمات بیاوین" className="biawin-credit-tickers">
          <TickerColumn items={CATEGORY_TICKER_UP} direction="up" />
          <TickerColumn items={CATEGORY_TICKER_DOWN} direction="down" />
        </div>

        <div className="biawin-credit-power-copy">
          <span className="biawin-credit-power-eyebrow">قدرت اعتبار در باشگاه</span>
          <h3>
            هر یک میلیون تومان در بیاوین <b>۴ میلیون</b> کار می‌کند
          </h3>
          <p>دو ستون خدمات به‌صورت پیوسته بالا و پایین حرکت می‌کنند تا همه دسته‌بندی‌های بیاوین را یکجا ببینید.</p>
          <button type="button" className="biawin-primary-btn" onClick={() => router.push("/services")}>
            مشاهده همه خدمات
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        .biawin-credit-power-section{
          position:relative;overflow:hidden;padding:26px 18px;
          background:linear-gradient(145deg,#075ba9 0%,#0879dc 58%,#36a1ee 100%);
        }
        .biawin-credit-power-shell{
          position:relative;z-index:1;display:grid;
          grid-template-columns:minmax(185px,.82fr) minmax(0,1.28fr);gap:22px;align-items:center;direction:rtl;
        }
        .biawin-credit-tickers{
          --ticker-item-h:114px;--ticker-gap:16px;
          display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;
          height:calc((var(--ticker-item-h) * 4) + (var(--ticker-gap) * 3));
          overflow:hidden;position:relative;padding:4px 6px;
        }
        .biawin-ticker-col{position:relative;min-width:0;overflow:hidden;border-radius:999px}
        .biawin-ticker-track{display:flex;flex-direction:column;gap:var(--ticker-gap);will-change:transform}
        .biawin-ticker-track--up{animation:biawinTickerUp 28s linear infinite}
        .biawin-ticker-track--down{
          transform:translateY(calc(-50% - (var(--ticker-gap) / 2)));
          animation:biawinTickerDown 31s linear infinite;
        }
        .biawin-ticker-col:hover .biawin-ticker-track,
        .biawin-ticker-col:focus-within .biawin-ticker-track{animation-play-state:paused}
        @keyframes biawinTickerUp{from{transform:translateY(0)}to{transform:translateY(calc(-50% - (var(--ticker-gap) / 2)))}}
        @keyframes biawinTickerDown{from{transform:translateY(calc(-50% - (var(--ticker-gap) / 2)))}to{transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){.biawin-ticker-track{animation-duration:80s!important}}

        .biawin-ticker-fade{position:absolute;right:0;left:0;height:38px;z-index:4;pointer-events:none}
        .biawin-ticker-fade--top{top:0;background:linear-gradient(180deg,#0875d2 0%,rgba(8,117,210,0) 100%)}
        .biawin-ticker-fade--bottom{bottom:0;background:linear-gradient(0deg,#1689dc 0%,rgba(22,137,220,0) 100%)}

        .biawin-credit-service-item{
          height:var(--ticker-item-h);min-height:var(--ticker-item-h);
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
          color:#fff;padding:0 2px;
        }
        .biawin-credit-service-photo{
          display:block;width:88px;height:88px;border-radius:50%;overflow:hidden;
          border:5px solid rgba(255,255,255,.88);background:#fff;box-shadow:0 14px 30px rgba(0,45,88,.28);
        }
        .biawin-credit-service-photo img{width:100%;height:100%;object-fit:cover}
        .biawin-credit-service-name{
          font-size:12px;line-height:1.5;font-weight:800;white-space:nowrap;
          max-width:120px;overflow:hidden;text-overflow:ellipsis;
        }

        .biawin-credit-power-copy{padding-right:21px;border-right:1px solid rgba(255,255,255,.25);text-align:right;color:#fff}
        .biawin-credit-power-eyebrow{
          display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;
          background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.13);font-size:10px;font-weight:700;opacity:.95;
        }
        .biawin-credit-power-copy h3{font-size:23px;line-height:1.85;margin:9px 0;font-weight:500}
        .biawin-credit-power-copy h3 b{display:block;font-size:34px;line-height:1.4;font-weight:900;color:#fff}
        .biawin-credit-power-copy p{font-size:10.5px;line-height:2;opacity:.82;margin:0 0 14px;max-width:330px}

        .biawin-primary-btn{
          border:0;background:#fff;color:${color.deep};border-radius:15px;height:45px;padding:0 17px;
          display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;
          box-shadow:0 12px 28px rgba(0,38,74,.2);cursor:pointer;transition:.2s;
        }
        .biawin-primary-btn:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(0,38,74,.25)}

        @media(max-width:620px){
          .biawin-credit-power-section{padding:22px 12px}
          .biawin-credit-power-shell{grid-template-columns:minmax(134px,.82fr) minmax(0,1.18fr);gap:12px}
          .biawin-credit-tickers{--ticker-item-h:88px;--ticker-gap:10px;gap:9px}
          .biawin-credit-service-photo{width:66px;height:66px;border-width:4px}
          .biawin-credit-service-name{font-size:9px;max-width:86px}
          .biawin-credit-power-copy{padding-right:12px}
          .biawin-credit-power-eyebrow{font-size:8px;padding:5px 8px}
          .biawin-credit-power-copy h3{font-size:16px;line-height:1.8;margin:7px 0}
          .biawin-credit-power-copy h3 b{font-size:25px}
          .biawin-credit-power-copy p{font-size:8.5px;line-height:1.9;margin-bottom:10px}
          .biawin-primary-btn{height:38px;padding:0 11px;font-size:9px;border-radius:12px}
          .biawin-primary-btn svg{width:15px;height:15px}
        }
        @media(max-width:390px){
          .biawin-credit-power-shell{grid-template-columns:128px minmax(0,1fr);gap:9px}
          .biawin-credit-tickers{--ticker-item-h:78px;--ticker-gap:8px}
          .biawin-credit-service-photo{width:58px;height:58px}
          .biawin-credit-power-copy h3{font-size:15px}
          .biawin-credit-power-copy h3 b{font-size:23px}
        }
      `}</style>
    </section>
  );
}

function TickerColumn({ items, direction }: { items: readonly string[]; direction: "up" | "down" }) {
  return (
    <div className={`biawin-ticker-col biawin-ticker-col--${direction}`}>
      <div className="biawin-ticker-fade biawin-ticker-fade--top" />
      <div className={`biawin-ticker-track biawin-ticker-track--${direction}`}>
        {[...items, ...items].map((name, i) => (
          <div key={`${name}-${i}`} className="biawin-credit-service-item" aria-hidden={i >= items.length}>
            <span className="biawin-credit-service-photo">
              <img src={CATEGORY_TICKER_IMAGE[name]} alt={name} loading="lazy" />
            </span>
            <span className="biawin-credit-service-name">{name}</span>
          </div>
        ))}
      </div>
      <div className="biawin-ticker-fade biawin-ticker-fade--bottom" />
    </div>
  );
}
