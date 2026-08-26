"use client";

import { useRef, useState } from "react";
import { color } from "@biawin/ui";
import { useHomeNewsArticles } from "./useHomeCms";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function toPersianDigits(n: number): string {
  return String(n)
    .split("")
    .map((d) => PERSIAN_DIGITS[Number(d)] ?? d)
    .join("");
}

/**
 * `.news-sketch-section` — 8-article snap-scroll carousel, real photos
 * this time (Stage 5.13 correction — the first pass used a flat color
 * background instead of the prototype's actual article images,
 * extracted this session — see docs/home-prototype-asset-map.md). No
 * `NewsArticle` backend model exists yet
 * (docs/prototype-to-production-mapping.md P2 item) — mock content,
 * "مشاهده مقاله" is a real `disabled` control since there's no article
 * page to open.
 */
export function NewsCarousel() {
  const { articles } = useHomeNewsArticles();
  const [current, setCurrent] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    const step = (card?.clientWidth ?? 238) + 12;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDistance = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const cardCenter = el.offsetLeft + el.clientWidth / 2;
      const distance = Math.abs(cardCenter - trackCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = i;
      }
    });
    setCurrent(closest + 1);
  }

  return (
    <section className="biawin-news-section">
      <div className="biawin-news-title">
        <strong>مقالات و اخبار بیاوین</strong>
        <small>{toPersianDigits(articles.length)} مقاله و خبر؛ برای دیدن همه موارد به چپ و راست اسکرول کنید</small>
      </div>

      <div className="biawin-news-carousel-wrap">
        <button type="button" aria-label="خبر قبلی" onClick={() => scrollByCard(-1)} className="biawin-news-arrow">
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>

        <div ref={trackRef} onScroll={handleScroll} className="biawin-news-track">
          {articles.map((article, i) => (
            <article key={article.id} className={`biawin-news-card${i === current - 1 ? " biawin-news-card--active" : ""}`}>
              <div className="biawin-news-media">
                {article.image && <img src={article.image} alt={article.category} loading="lazy" />}
                <span>{article.category}</span>
              </div>
              <div className="biawin-news-copy">
                <small>{article.kicker}</small>
                <strong>{article.title}</strong>
                <p>{article.lead}</p>
                <button type="button" disabled aria-label="مشاهده مقاله — به‌زودی" className="biawin-news-read-more">
                  مشاهده مقاله
                </button>
              </div>
            </article>
          ))}
        </div>

        <button type="button" aria-label="خبر بعدی" onClick={() => scrollByCard(1)} className="biawin-news-arrow">
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="biawin-news-counter">
        <b>{toPersianDigits(current)}</b>
        <span>از</span>
        <b>{toPersianDigits(articles.length)}</b>
      </div>

      <style>{`
        .biawin-news-section{padding:19px 0 9px;position:relative}
        .biawin-news-title{padding:0 18px;margin-bottom:4px}
        .biawin-news-title strong{display:block;font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-news-title small{display:block;font-size:10px;color:${color.muted};margin-top:2px}

        .biawin-news-carousel-wrap{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;align-items:center;gap:7px;padding:0 8px}
        .biawin-news-arrow{
          all:unset;width:38px;height:38px;border-radius:50%;background:#fff;border:1px solid #d9eafa;color:${color.primary};
          display:grid;place-items:center;box-shadow:0 9px 20px rgba(7,78,145,.12);cursor:pointer;box-sizing:border-box;
        }

        .biawin-news-track{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x mandatory;padding:8px 0 24px}
        .biawin-news-track::-webkit-scrollbar{display:none}
        .biawin-news-card{
          flex:0 0 min(78vw,268px);min-height:342px;background:#fff;border:1px solid #dcebf8;border-radius:28px;
          overflow:hidden;box-shadow:0 16px 34px rgba(6,72,132,.13);scroll-snap-align:center;
          transform:scale(.94);opacity:.72;transition:transform .25s ease,opacity .25s ease;display:flex;flex-direction:column;
        }
        .biawin-news-card--active{transform:scale(1);opacity:1}
        .biawin-news-media{height:174px;position:relative;overflow:hidden}
        .biawin-news-media img{width:100%;height:100%;object-fit:cover}
        .biawin-news-media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,38,73,.02),rgba(4,38,73,.68))}
        .biawin-news-media span{
          position:absolute;z-index:2;right:13px;bottom:12px;color:#fff;font-size:11px;font-weight:800;
          background:rgba(255,255,255,.13);padding:6px 10px;border-radius:999px;backdrop-filter:blur(5px);
        }
        .biawin-news-copy{padding:14px 14px 18px;display:flex;flex:1;flex-direction:column}
        .biawin-news-copy small{display:block;color:${color.primary};font-size:9px;font-weight:800;margin-bottom:6px}
        .biawin-news-copy strong{display:block;color:${color.ink};font-size:15px;line-height:1.8;margin-bottom:6px}
        .biawin-news-copy p{margin:0 0 14px;color:${color.muted};font-size:10px;line-height:1.95}
        .biawin-news-read-more{
          all:unset;margin-top:auto;align-self:flex-start;color:${color.primary};font-size:11px;font-weight:700;
          cursor:not-allowed;opacity:.7;
        }

        .biawin-news-counter{display:flex;justify-content:center;align-items:center;gap:6px;color:${color.muted};font-size:11px;margin-top:-9px;margin-bottom:9px}
        .biawin-news-counter b{color:${color.primary};font-size:13px}

        @media(min-width:621px){
          .biawin-news-carousel-wrap{grid-template-columns:34px minmax(0,1fr) 34px}
          .biawin-news-arrow{width:34px;height:34px}
          .biawin-news-card{flex-basis:min(78vw,268px);min-height:418px}
          .biawin-news-media{height:178px;flex-basis:178px}
        }
      `}</style>
    </section>
  );
}
