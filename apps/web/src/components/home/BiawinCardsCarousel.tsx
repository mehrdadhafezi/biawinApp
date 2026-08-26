"use client";

import { useRef, useState } from "react";
import { color } from "@biawin/ui";
import { useHomeHeroCards } from "./useHomeCms";
import type { HeroIconChip } from "./homeCmsAdapter";

/** `.card-icon svg` — verbatim prototype path data per card (re-verified against the source this session; the "card" icon is a rounded `<rect rx="3">`, not a hand-drawn path, so it's rendered as real SVG primitives below instead of approximated as a `d` path). */
function CardIcon({ chip }: { chip: HeroIconChip }) {
  if (chip === "trend") {
    return (
      <>
        <path d="M4 17l5-5 4 4 7-8" />
        <path d="M15 8h5v5" />
      </>
    );
  }
  if (chip === "card") {
    return (
      <>
        <rect height={14} rx={3} width={18} x={3} y={5} />
        <path d="M3 10h18M7 15h3" />
      </>
    );
  }
  return <path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5V7Z" />;
}

/**
 * `.hero` — the "Biawin Cards" swipeable carousel: center-active card,
 * side cards partially visible, dot pagination, chip/gradient/typography
 * pixel-matched to `#cardTrack` in the prototype. Tapping a card would
 * open Card Detail, which doesn't exist yet — real `disabled` buttons.
 *
 * Stage 5.14.1 fix: on live staging, the "BiaWin" brand row was rendering
 * dropped ~50px down the card, overlapping the title/subtitle block.
 * Root cause, isolated empirically (not eyeballed): Chromium's native
 * `<button>` rendering vertically centers its in-flow content
 * REGARDLESS of `all: unset` or an explicit `display: block` on the
 * button itself — confirmed by reproducing the exact same offset on a
 * bare `<button style="all:unset;display:block;...">` test element, and
 * confirming the offset disappears entirely both on a `<div>` with
 * identical CSS and on the *same* `<button>` once its own `display`
 * resolves to `flex` instead of `block`. `.biawin-credit-card`'s only
 * in-flow child is the brand/label row (the title and bottom blocks are
 * `position: absolute`, unaffected either way) — adding
 * `display:flex;flex-direction:column` here removes the native
 * centering without changing anything else, since a flex container with
 * one non-`flex-grow` child sizes exactly like the block layout already
 * intended.
 */
export function BiawinCardsCarousel() {
  const { cards } = useHomeHeroCards();
  const [activeIndex, setActiveIndex] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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
    setActiveIndex(closest);
  }

  return (
    <section aria-label="کارت‌های بیاوین" className="biawin-hero-section">
      <div className="biawin-hero-title">
        <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: color.ink }}>کارت‌های بیاوین</h2>
        <span style={{ fontSize: 11, color: color.muted }}>برای مشاهده، ورق بزنید</span>
      </div>

      <div style={{ position: "relative", overflow: "hidden", padding: "3px 0 18px" }}>
        <div ref={trackRef} onScroll={handleScroll} dir="ltr" className="biawin-card-track">
          {cards.map((card, index) => (
            <button
              key={card.key}
              type="button"
              disabled
              aria-label={`${card.ariaLabel} — به‌زودی`}
              className="biawin-credit-card"
              style={{
                background: card.gradient,
                transform: index === activeIndex ? "scale(1)" : "scale(.94)",
                opacity: index === activeIndex ? 1 : 0.74,
                filter: index === activeIndex ? "saturate(1.08)" : "none",
              }}
            >
              <div dir="rtl" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.3px" }}>BiaWin</div>
                  <div style={{ fontSize: 11, opacity: 0.82, marginTop: 4 }}>{card.label}</div>
                </div>
                <div className="biawin-credit-card-chip" />
              </div>
              <div dir="rtl" className="biawin-credit-card-center">
                <strong className="biawin-credit-card-title">{card.title}</strong>
                <span style={{ fontSize: 12, opacity: 0.82 }}>{card.subtitle}</span>
              </div>
              <div dir="rtl" className="biawin-credit-card-bottom">
                <div>
                  <div className="biawin-credit-card-number">{card.number}</div>
                  <div style={{ fontSize: 10, opacity: 0.78, marginTop: 4 }}>{card.owner}</div>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}>
                  <svg viewBox="0 0 24 24" width={22} fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <CardIcon chip={card.iconChip} />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div aria-label="انتخاب کارت" style={{ display: "flex", justifyContent: "center", gap: 7, alignItems: "center", direction: "ltr" }}>
        {cards.map((card, index) => (
          <button
            key={card.key}
            type="button"
            aria-label={`کارت ${card.title}`}
            onClick={() => scrollToIndex(index)}
            style={{
              width: index === activeIndex ? 24 : 7,
              height: 7,
              borderRadius: 99,
              background: index === activeIndex ? color.primary : "#c6d8e8",
              border: 0,
              padding: 0,
              transition: ".2s",
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      <style>{`
        .biawin-hero-section{position:relative;padding:26px 0 10px;background:radial-gradient(circle at 50% 0, rgba(8,121,220,.14), transparent 45%), linear-gradient(180deg,#fff 0,#f8fcff 100%)}
        .biawin-hero-title{padding:0 20px;display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:15px}
        @media(max-width:620px){
          .biawin-hero-section{padding-top:18px}
          .biawin-hero-title{padding:0 16px}
        }
        .biawin-card-track{display:flex;direction:ltr;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:0}
        .biawin-card-track::-webkit-scrollbar{display:none}
        .biawin-credit-card{
          all:unset;display:flex;flex-direction:column;
          flex:0 0 min(82vw,470px);aspect-ratio:1.62/1;scroll-snap-align:center;
          border-radius:26px;padding:22px;color:#fff;position:relative;overflow:hidden;
          box-shadow:0 17px 45px rgba(4,79,152,.18);transition:transform .28s ease,opacity .28s ease,filter .28s ease;
          cursor:not-allowed;isolation:isolate;box-sizing:border-box;
        }
        .biawin-credit-card:before{
          content:"";position:absolute;inset:auto -16% -45% auto;width:75%;aspect-ratio:1;border-radius:50%;
          border:1px solid rgba(255,255,255,.25);
          box-shadow:0 0 0 22px rgba(255,255,255,.06),0 0 0 48px rgba(255,255,255,.04);z-index:-1;
        }
        .biawin-credit-card:after{
          content:"";position:absolute;inset:0;
          background:linear-gradient(125deg,rgba(255,255,255,.18),transparent 35%,transparent 65%,rgba(255,255,255,.1));z-index:-1;
        }
        .biawin-credit-card-center{position:absolute;right:22px;left:22px;top:46%;transform:translateY(-50%)}
        .biawin-credit-card-title{font-size:27px;display:block;font-weight:800;letter-spacing:-1px}
        .biawin-credit-card-bottom{position:absolute;right:22px;left:22px;bottom:20px;display:flex;align-items:flex-end;justify-content:space-between}
        .biawin-credit-card-number{direction:ltr;letter-spacing:2px;font-size:12px;font-weight:600}
        .biawin-credit-card-chip{
          width:47px;height:35px;border-radius:10px;position:relative;
          background:linear-gradient(135deg,#f7df95,#d5ab3c);
          box-shadow:inset 0 0 0 1px rgba(70,44,0,.14);
        }
        .biawin-credit-card-chip:before,.biawin-credit-card-chip:after{content:"";position:absolute;background:rgba(96,70,0,.22)}
        .biawin-credit-card-chip:before{width:1px;height:100%;right:50%;top:0}
        .biawin-credit-card-chip:after{height:1px;width:100%;top:50%;left:0}
        @media(max-width:620px){
          .biawin-credit-card{border-radius:23px;padding:18px}
          .biawin-credit-card-center{right:18px;left:18px}
          .biawin-credit-card-bottom{right:18px;left:18px;bottom:16px}
          .biawin-credit-card-title{font-size:23px}
          .biawin-credit-card-number{font-size:10px;letter-spacing:1.4px}
        }
      `}</style>
    </section>
  );
}
