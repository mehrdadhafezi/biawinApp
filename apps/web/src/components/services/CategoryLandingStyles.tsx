/**
 * Category Landing's stylesheet — the approved prototype's
 * `.page-service-category` (`biawin_single_file_app_requested_edits_v16_
 * clean.html`: `.category-hero` / `.category-tools` / `.category-products-
 * section` / `.category-info-strip` at ~lines 1095–1156, and the
 * `.service-finance-card` visual at ~1712–1800), ported under a `cl-`
 * namespace. Values were taken from the prototype's COMPUTED styles (its
 * rules are layered through several `!important` overrides, so the effective
 * value — not any single rule — is what matches): a live render of the
 * prototype's own `openServiceCategory()` at 360–1440px was sampled.
 *
 * Deliberate deviations:
 * - The card visual's TEXT uses the prototype's own desktop sizes at every
 *   width. The prototype keeps its product grid at ONE column up to 740px
 *   (so the card is a full ~374px wide on a phone) but keeps shrinking the
 *   card's text with the viewport (title 8.8px, description 6.2px, tags
 *   5.6px at 390px) — sizes tuned for the two-column layout it abandoned.
 *   The desktop values are the ones designed for a card of exactly that
 *   width, and are legible; the card's geometry, gradients, rings, sheen,
 *   radius, padding and shadows are the prototype's, unchanged.
 * - The search input is 16px (the prototype's is 12px): under 16px iOS
 *   Safari zooms the page on focus — a real, previously fixed bug in this
 *   app (see `ServiceSearchInput`'s history).
 * - No fake card number / expiry / "MEMBERSHIP CLUB" line (the prototype's
 *   `VALID 08/29`, `•••• 2088`): they are decoration with no backend data.
 */
export function CategoryLandingStyles() {
  return (
    <style>{`
      .cl-page{background:linear-gradient(180deg,#f6fbff 0%,#ffffff 42%);color:#102f4a}
      .cl-main{width:min(100%,760px);margin:0 auto;padding:0 0 28px;background:#fff}
      .cl-page button{font-family:inherit}

      .cl-hero{position:relative;margin:14px 14px 0;min-height:245px;border-radius:30px;overflow:hidden;background:#0b4d88;box-shadow:0 20px 44px rgba(5,72,135,.17)}
      .cl-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      .cl-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,22,41,.08) 0%,rgba(5,31,58,.48) 54%,rgba(5,31,58,.94) 100%)}
      .cl-hero-copy{position:relative;z-index:2;min-height:245px;padding:20px;display:flex;flex-direction:column;justify-content:flex-end;color:#fff}
      .cl-hero-label{position:absolute;top:16px;right:16px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.22);font-size:10px;font-weight:900;backdrop-filter:blur(7px)}
      .cl-hero h1{margin:0 0 7px;font-size:28px;font-weight:900;line-height:1.45}
      .cl-hero p{margin:0;font-size:11px;line-height:2;opacity:.95;max-width:92%}
      .cl-hero-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
      .cl-hero-meta span{padding:7px 10px;border-radius:12px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.14);font-size:9px;font-weight:800}

      .cl-tools{padding:18px 14px 0}
      .cl-search{height:46px;display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid #d9e9f8;border-radius:16px;background:#f8fbfe;box-shadow:0 9px 24px rgba(6,73,135,.06)}
      .cl-search svg{width:20px;height:20px;flex:0 0 20px;fill:none;stroke:var(--category-accent);stroke-width:2}
      .cl-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#123b5f;font-size:16px;font-family:inherit}
      .cl-filter-row{display:flex;gap:8px;overflow-x:auto;padding:12px 0 3px;scrollbar-width:none}
      .cl-filter-row::-webkit-scrollbar{display:none}
      .cl-filter{flex:0 0 auto;padding:8px 12px;border-radius:999px;border:1px solid #dbeaf8;background:#fff;color:#668097;font-size:10px;font-weight:800;cursor:pointer}
      .cl-filter.active{background:linear-gradient(135deg,var(--category-accent),var(--category-deep));border-color:transparent;color:#fff;box-shadow:0 9px 20px rgba(8,121,220,.17)}

      .cl-section{padding:21px 14px 0}
      .cl-section-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:13px}
      .cl-section-head h2{margin:0;font-size:18px;font-weight:700;color:#123b5f}
      .cl-section-head p{margin:4px 0 0;font-size:10px;line-height:1.8;color:#7a8fa2}
      .cl-count{padding:6px 10px;border-radius:999px;background:var(--category-soft);color:var(--category-accent);font-size:9px;font-weight:900;white-space:nowrap}
      .cl-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:28px;padding:12px 0 30px}
      .cl-empty{padding:34px 15px;text-align:center;border:1px dashed #cadff2;border-radius:22px;background:#f8fbfe;color:#7890a4;font-size:11px;line-height:2}

      .cl-fc{position:relative;min-width:0}
      .cl-fc-hit{position:absolute;inset:0;z-index:5;width:100%;height:100%;padding:0;border:0;border-radius:24px;background:transparent;cursor:pointer}
      .cl-fc-hit:focus-visible{outline:3px solid var(--category-accent);outline-offset:3px}
      .cl-fc-visual{position:relative;min-height:166px;aspect-ratio:1.62/1;border-radius:24px;overflow:hidden;padding:17px;color:#fff;isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 26px 38px rgba(5,58,105,.17),0 7px 14px rgba(5,58,105,.10),inset 0 1px 0 rgba(255,255,255,.26);transform-origin:50% 60%;animation:clFloat 4.8s ease-in-out infinite;will-change:transform}
      .cl-fc:nth-child(2n) .cl-fc-visual{animation-delay:-1.25s;animation-duration:5.35s}
      .cl-fc:nth-child(3n) .cl-fc-visual{animation-delay:-2.4s;animation-duration:4.35s}
      .cl-fc:nth-child(4n) .cl-fc-visual{animation-delay:-3.1s;animation-duration:5.8s}
      .cl-fc--installment .cl-fc-visual{background:linear-gradient(135deg,#0c82e8 0%,#075cae 55%,#073f7b 100%)}
      .cl-fc--credit .cl-fc-visual{background:linear-gradient(135deg,#252b36 0%,#111820 56%,#070b10 100%)}
      .cl-fc--discount .cl-fc-visual{background:linear-gradient(135deg,#ff8d3a 0%,#ed5c21 54%,#b72f20 100%)}
      .cl-fc--mixed .cl-fc-visual{background:linear-gradient(135deg,#8457e8 0%,#5531b6 54%,#2c176f 100%)}
      .cl-fc-visual--photo{background-size:cover!important;background-position:center!important}
      .cl-fc-visual:before{content:"";position:absolute;width:180px;height:180px;border-radius:50%;left:-78px;top:-93px;border:1px solid rgba(255,255,255,.18);box-shadow:0 0 0 32px rgba(255,255,255,.055),0 0 0 64px rgba(255,255,255,.035);z-index:-1}
      .cl-fc-visual:after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.18),transparent 28%,transparent 68%,rgba(255,255,255,.06));z-index:-1}
      .cl-fc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .cl-fc-brand{display:block;font-size:14px;font-weight:700;letter-spacing:1px}
      .cl-fc-type{padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.18);font-size:8px;font-weight:900;white-space:nowrap}
      .cl-fc-chip{position:absolute;right:17px;top:63px;width:38px;height:28px;border-radius:8px;background:linear-gradient(135deg,#ffe9ab,#c89a3c);display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:5px}
      .cl-fc-chip i{border:1px solid rgba(84,54,8,.3);border-radius:2px}
      .cl-fc-main{padding-top:39px}
      .cl-fc-main small{display:block;font-size:8px;opacity:.78;margin-bottom:4px}
      .cl-fc-main strong{display:block;font-size:18px;line-height:1.45;font-weight:900}
      .cl-fc-main span{display:block;font-size:9px;line-height:1.8;opacity:.9;margin-top:2px}
      .cl-fc-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:8px;opacity:.82}
      .cl-fc-copy{padding:14px 6px 0}
      .cl-fc-copy h3{margin:0;font-size:14px;font-weight:700;line-height:1.6;color:#123d5f}
      .cl-fc-copy p{margin:5px 0 0;font-size:9px;line-height:1.85;color:#758b9d}
      .cl-fc-price{margin-top:8px;display:flex;align-items:baseline;justify-content:space-between;gap:8px}
      .cl-fc-price small{font-size:9px;color:#7b90a3}
      .cl-fc-price b{font-size:12px;font-weight:900;color:var(--category-accent)}
      .cl-fc-open{display:flex;align-items:center;justify-content:space-between;padding:4px 0 0;margin-top:10px}
      .cl-fc-open b{font-size:9px;font-weight:700;color:var(--category-accent)}
      .cl-fc-open i{width:28px;height:28px;border-radius:10px;background:var(--category-soft);color:var(--category-accent);display:grid;place-items:center;font-style:normal;font-size:15px;font-weight:900;box-shadow:0 7px 18px rgba(8,121,220,.10)}

      .cl-strip{margin:20px 14px 0;padding:14px;border-radius:21px;background:linear-gradient(135deg,#eef7ff,#f8fbff);border:1px solid #d8eafa;display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:center}
      .cl-strip i{width:42px;height:42px;border-radius:14px;background:#fff;color:var(--category-accent);display:grid;place-items:center;font-style:normal;font-size:19px;box-shadow:0 8px 19px rgba(8,121,220,.08)}
      .cl-strip strong{display:block;font-size:11px;font-weight:700;color:#173d5d}
      .cl-strip span{display:block;margin-top:4px;font-size:9px;color:#7890a3;line-height:1.8}

      @keyframes clFloat{
        0%,100%{transform:translate3d(0,0,0) rotate(-.45deg)}
        25%{transform:translate3d(0,-8px,0) rotate(.35deg)}
        50%{transform:translate3d(0,-14px,0) rotate(.7deg)}
        75%{transform:translate3d(0,-7px,0) rotate(-.15deg)}
      }
      @media(prefers-reduced-motion:reduce){.cl-fc-visual{animation:none!important}}

      @media(min-width:741px){
        .cl-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:26px 18px;padding:18px 0 30px}
      }
      @media(max-width:620px){
        .cl-hero{min-height:220px;border-radius:26px}
        .cl-hero-copy{min-height:220px;padding:17px}
        .cl-hero h1{font-size:25px}
        .cl-section{padding:21px 16px 0}
      }
      @media(max-width:520px){.cl-section{padding:16px 10px 0}}
      @media(max-width:390px){.cl-section{padding:16px 8px 0}}
    `}</style>
  );
}
