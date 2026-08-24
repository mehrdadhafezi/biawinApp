"use client";

import { useRef, useState } from "react";
import { color } from "@biawin/ui";
import { NEWS_ARTICLES } from "./home.mock";

const NEWS_MEDIA_COLOR = ["#0879dc", "#ff9f2f", "#29a5a6", "#8d6e63", "#e75480", "#3f51b5", "#44a047", "#9c27b0"];
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function toPersianDigits(n: number): string {
  return String(n)
    .split("")
    .map((d) => PERSIAN_DIGITS[Number(d)] ?? d)
    .join("");
}

/**
 * `.news-sketch-section` — 8-article snap-scroll carousel, pixel-matched
 * to the prototype. No `NewsArticle` backend model exists yet
 * (docs/prototype-to-production-mapping.md P2 item) — mock content,
 * "مشاهده مقاله" is a real `disabled` control since there's no article
 * page to open.
 */
export function NewsCarousel() {
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
    <section style={{ padding: "19px 0 9px", position: "relative" }}>
      <div style={{ padding: "0 18px", marginBottom: 4 }}>
        <strong style={{ display: "block", fontSize: 13, fontWeight: 700, color: color.ink }}>مقالات و اخبار بیاوین</strong>
        <small style={{ display: "block", fontSize: 10, color: color.muted, marginTop: 2 }}>
          {toPersianDigits(NEWS_ARTICLES.length)} مقاله و خبر؛ برای دیدن همه موارد به چپ و راست اسکرول کنید
        </small>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "38px minmax(0,1fr) 38px", alignItems: "center", gap: 7, padding: "0 8px" }}>
        <button
          type="button"
          aria-label="خبر قبلی"
          onClick={() => scrollByCard(-1)}
          style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", border: "1px solid #d9eafa", color: color.primary, display: "grid", placeItems: "center", boxShadow: "0 9px 20px rgba(7,78,145,.12)", cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>

        <div ref={trackRef} onScroll={handleScroll} className="biawin-news-track">
          {NEWS_ARTICLES.map((article, i) => (
            <article key={article.title} className="biawin-news-card" style={{ opacity: i === current - 1 ? 1 : 0.72, transform: i === current - 1 ? "scale(1)" : "scale(.94)" }}>
              <div style={{ height: 178, position: "relative", background: NEWS_MEDIA_COLOR[i % NEWS_MEDIA_COLOR.length], display: "flex", alignItems: "flex-end" }}>
                <span style={{ position: "absolute", zIndex: 2, right: 13, bottom: 12, color: "#fff", fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,.18)", padding: "6px 10px", borderRadius: 999 }}>
                  {article.category}
                </span>
              </div>
              <div style={{ padding: "16px 16px 18px", display: "flex", flex: 1, flexDirection: "column" }}>
                <small style={{ display: "block", color: color.primary, fontSize: 9, fontWeight: 800, marginBottom: 6 }}>{article.kicker}</small>
                <strong style={{ display: "block", color: color.ink, fontSize: 15, lineHeight: 1.8, marginBottom: 6 }}>{article.title}</strong>
                <p style={{ margin: "0 0 14px", color: color.muted, fontSize: 11, lineHeight: 2 }}>{article.lead}</p>
                <button type="button" disabled aria-label="مشاهده مقاله — به‌زودی" style={{ marginTop: "auto", alignSelf: "flex-start", border: 0, background: "transparent", color: color.primary, fontSize: 11, fontWeight: 700, cursor: "not-allowed", opacity: 0.7, padding: 0 }}>
                  مشاهده مقاله
                </button>
              </div>
            </article>
          ))}
        </div>

        <button
          type="button"
          aria-label="خبر بعدی"
          onClick={() => scrollByCard(1)}
          style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", border: "1px solid #d9eafa", color: color.primary, display: "grid", placeItems: "center", boxShadow: "0 9px 20px rgba(7,78,145,.12)", cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, color: color.muted, fontSize: 11, marginTop: 4 }}>
        <b style={{ color: color.primary, fontSize: 13 }}>{toPersianDigits(current)}</b>
        <span>از</span>
        <b>{toPersianDigits(NEWS_ARTICLES.length)}</b>
      </div>

      <style>{`
        .biawin-news-track{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x mandatory;padding:8px 0 24px}
        .biawin-news-track::-webkit-scrollbar{display:none}
        .biawin-news-card{
          flex:0 0 min(78vw,268px);min-height:340px;background:#fff;border:1px solid #dcebf8;border-radius:28px;
          overflow:hidden;box-shadow:0 16px 34px rgba(6,72,132,.13);scroll-snap-align:center;
          transition:transform .25s ease,opacity .25s ease;display:flex;flex-direction:column;
        }
      `}</style>
    </section>
  );
}
