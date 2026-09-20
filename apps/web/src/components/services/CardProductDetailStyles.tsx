import { layout } from "@biawin/ui";

/**
 * Card Product Detail's stylesheet — the approved prototype's
 * `.page-service-detail.card-only-mode` CSS
 * (`biawin_single_file_app_requested_edits_v16_clean.html`: the base
 * `.detail-*` block at ~lines 1022–1087 plus the cardOnly block at
 * ~5536–5690), ported value-for-value (px sizes, radii, gradients, shadows,
 * the 620px/380px breakpoints) under a `cpd-` namespace. It needs real CSS
 * rather than inline styles because the prototype's fidelity depends on
 * media queries, `::after` gradient overlays and `backdrop-filter`.
 * Same one-`<style>`-per-page pattern `SkeletonStyles` already uses.
 *
 * Deliberate deviations, each because the app's shell differs from the
 * prototype's single-file scroller:
 * - `.cpd-buybar` is `position: sticky`, not `fixed` — `AppShell`'s
 *   `transform: translateZ(0)` column turns `fixed` into "absolute to a
 *   content-height box" (the exact trap `BottomNavigation`'s own doc
 *   comment describes and solves with `sticky`).
 * - The prototype's header caption is a `span` (see `ServicesPageHeader`):
 *   the page's `h1` is the card title in the hero (the prototype's `h2`),
 *   so the document keeps one meaningful top-level heading.
 */
export function CardProductDetailStyles() {
  return (
    <style>{`
      .cpd-page{--detail-accent:#0879dc;--detail-deep:#064d91;--detail-soft:#eef7ff;background:linear-gradient(180deg,#f7fbff 0%,#ffffff 36%);color:#102f4a}
      .cpd-main{width:min(100%,760px);margin:0 auto;padding:0 0 28px;background:#fff}
      .cpd-page button{font-family:inherit;cursor:pointer}


      .cpd-hero{position:relative;margin:14px 14px 0;min-height:310px;border-radius:31px;overflow:hidden;background:#0b4d88;box-shadow:0 22px 45px rgba(5,72,135,.19)}
      .cpd-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      .cpd-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,24,45,.05) 10%,rgba(5,32,59,.52) 57%,rgba(5,31,58,.95) 100%)}
      .cpd-hero-copy{position:relative;z-index:2;min-height:310px;padding:22px 20px;display:flex;flex-direction:column;justify-content:flex-end;color:#fff}
      .cpd-hero-badges{position:absolute;top:18px;right:18px;left:18px;display:flex;gap:8px;flex-wrap:wrap}
      .cpd-hero-badge{padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(7px);font-size:10px;font-weight:800}
      .cpd-hero h1{margin:0 0 8px;font-size:29px;line-height:1.45;font-weight:900}
      .cpd-hero p{margin:0;font-size:12px;line-height:2;opacity:.94;max-width:94%}
      .cpd-hero-stats{display:grid;gap:8px;margin-top:16px}
      .cpd-hero-stat{padding:10px 8px;border-radius:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);text-align:center;backdrop-filter:blur(6px)}
      .cpd-hero-stat b{display:block;font-size:13px;margin-bottom:3px}
      .cpd-hero-stat span{display:block;font-size:9px;opacity:.85}

      .cpd-section{padding:22px 14px 0}
      .cpd-section-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:13px}
      /* explicit weight: Tailwind's preflight resets headings to inherit; the prototype's h3 is browser-default bold */
      .cpd-section-head h2{margin:0;font-size:18px;font-weight:700;color:#123b5f}
      .cpd-section-head p{margin:4px 0 0;font-size:10px;color:#73899d;line-height:1.8}
      .cpd-section-tag{padding:6px 10px;border-radius:999px;background:var(--detail-soft);color:var(--detail-accent);font-size:9px;font-weight:800;white-space:nowrap}

      .cpd-summary{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:16px;border:1px solid #dcebf7;border-radius:22px;background:linear-gradient(145deg,#f7fbff,#eef7ff)}
      .cpd-summary-main span{display:block;color:#7a90a3;font-size:9px;margin-bottom:4px}
      .cpd-summary-main strong{display:block;color:#123d60;font-size:16px;line-height:1.55}
      .cpd-summary-main p{margin:5px 0 0;color:#6f8598;font-size:9.5px;line-height:1.9}
      .cpd-summary-value{min-width:105px;padding:11px 10px;border-radius:17px;background:#fff;border:1px solid #dbeaf6;text-align:center;box-shadow:0 8px 20px rgba(5,72,135,.06)}
      .cpd-summary-value small{display:block;color:#7890a4;font-size:8px;margin-bottom:4px}
      .cpd-summary-value b{display:block;color:var(--detail-accent);font-size:12px;line-height:1.6}
      .cpd-facts{display:grid;gap:8px;margin-top:10px}
      .cpd-fact{padding:11px 9px;border:1px solid #e0edf7;border-radius:17px;background:#fff;text-align:center}
      .cpd-fact span{display:block;color:#8194a6;font-size:8px;margin-bottom:4px}
      .cpd-fact b{display:block;color:#17405f;font-size:9.5px;line-height:1.6}

      .cpd-features{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
      .cpd-feature{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #e0edf8;border-radius:18px;background:#fbfdff}
      .cpd-feature i{width:36px;height:36px;flex:0 0 36px;border-radius:12px;background:var(--detail-soft);color:var(--detail-accent);display:grid;place-items:center;font-style:normal;font-size:17px}
      .cpd-feature strong{display:block;font-size:11px;color:#183d5b;line-height:1.7}

      .cpd-process{display:grid;gap:9px}
      .cpd-step{display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:center;padding:12px;border-radius:18px;background:#f8fbfe;border:1px solid #e0edf7}
      .cpd-step-number{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--detail-accent),var(--detail-deep));color:#fff;display:grid;place-items:center;font-size:13px;font-weight:900}
      .cpd-step strong{display:block;font-size:12px}
      .cpd-step p{margin:3px 0 0;font-size:9px;line-height:1.8;color:#7a8fa2}

      .cpd-faq{display:grid;gap:8px}
      .cpd-faq-item{border:1px solid #deebf7;border-radius:17px;background:#fff;overflow:hidden}
      .cpd-faq-question{width:100%;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;background:#fff;color:#173b59;text-align:right;font-size:11px;font-weight:800}
      .cpd-faq-question span:last-child{font-size:18px;color:var(--detail-accent);transition:.2s}
      .cpd-faq-item.open .cpd-faq-question span:last-child{transform:rotate(45deg)}
      .cpd-faq-answer{display:none;padding:0 14px 14px;font-size:10px;line-height:2;color:#72889b}
      .cpd-faq-item.open .cpd-faq-answer{display:block}

      .cpd-buybar{position:sticky;bottom:${layout.bottomNavHeight}px;z-index:190;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:11px 14px;background:rgba(255,255,255,.96);border-top:1px solid #dceaf6;box-shadow:0 -14px 35px rgba(5,67,124,.11);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
      .cpd-buy-summary small{display:block;font-size:9px;color:#7990a4}
      .cpd-buy-summary strong{display:block;font-size:13px;color:#133b5d;margin-top:2px}
      .cpd-buy-btn{border:0;border-radius:16px;padding:12px 20px;min-width:126px;background:linear-gradient(135deg,var(--detail-accent),var(--detail-deep));color:#fff;font-size:11px;font-weight:900;box-shadow:0 10px 22px rgba(8,121,220,.22)}
      .cpd-buy-btn:disabled{background:#c9d8e6;box-shadow:none;cursor:not-allowed}

      @media(max-width:620px){
        .cpd-hero{margin:10px 10px 0;min-height:292px;border-radius:27px}
        .cpd-hero-copy{min-height:292px;padding:18px 16px}
        .cpd-hero h1{font-size:25px}
        .cpd-section{padding:19px 10px 0}
        .cpd-buybar{padding-inline:10px}
        .cpd-buy-btn{padding:12px 15px}
        .cpd-summary{grid-template-columns:1fr;gap:9px;padding:13px;border-radius:19px}
        .cpd-summary-value{min-width:0;width:100%;display:flex;justify-content:space-between;align-items:center;text-align:right;padding:9px 11px}
        .cpd-summary-value small,.cpd-summary-value b{margin:0}
        .cpd-facts{gap:6px}
        .cpd-fact{padding:9px 5px;border-radius:14px}
        .cpd-fact span{font-size:6.8px}
        .cpd-fact b{font-size:8px}
      }
      @media(max-width:380px){
        .cpd-features{grid-template-columns:1fr}
        .cpd-hero-stat b{font-size:11px}
      }
    `}</style>
  );
}
