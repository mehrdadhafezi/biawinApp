import { color, font } from "@biawin/ui";

/**
 * The permanent app header — pixel-matched to `<header class="header">`
 * inside `.page-home` in `biawin_single_file_app_requested_edits_v15.html`
 * (the pixel-perfect Home migration's source of truth). The prototype
 * frames this as shell-level chrome ("Fixed Header ... same across
 * screens"), so — like `BottomNavigation` — it's the same on every page,
 * replacing Stage 5.2's per-page "سلام {firstName} / {pageLabel}" header
 * (`PageHeader.tsx`, now unused).
 *
 * Responsive rule re-audited directly from the prototype's CSS cascade
 * (Stage 5.13 correction — the first pass had zero `@media` handling at
 * all): at `max-width:620px` the prototype's *later* `.page-home .header`
 * declaration (line 2708, which wins over an earlier line-387 rule for
 * the same selector+media-query since it comes later in the cascade)
 * keeps the 3-column grid but tightens it, hides the "بیاوین/BIAWIN"
 * text label, and collapses App Guide to an icon-only square — not the
 * single-column stack an earlier, superseded rule implied.
 *
 * The App Guide and search box have no backing feature yet (no guide
 * content, no search endpoint — docs/services-ui-contract.md §6 already
 * flagged search as MISSING) — both are real `disabled` controls. No
 * separate visible "به‌زودی" caption is rendered here (unlike most
 * other disabled controls in this app) because the prototype's own
 * header has no room for one without changing its exact height — the
 * `disabled` state + `aria-label` communicate it instead, the same way
 * the search input's own placeholder carries the hint rather than an
 * extra element.
 */
export function GlobalHeader() {
  return (
    <header className="biawin-app-header">
      <a aria-label="بیاوین" href="/home" className="biawin-app-header-brand">
        <span aria-hidden="true" className="biawin-app-header-brand-mark">
          <BrandMarkRings />
        </span>
        <span className="biawin-app-header-brand-text">
          <strong style={{ fontSize: 20, fontWeight: 800, color: color.deep, letterSpacing: "-.5px" }}>بیاوین</strong>
          <small style={{ fontSize: 9, color: color.primary, letterSpacing: 2, marginTop: 4 }}>BIAWIN</small>
        </span>
      </a>

      <button type="button" disabled aria-label="راهنمای اپلیکیشن — به‌زودی" className="biawin-app-header-guide">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z" />
        </svg>
        <span className="biawin-app-header-guide-text">راهنما</span>
      </button>

      <label className="biawin-app-header-search">
        <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke={color.primary} strokeWidth={2} aria-hidden="true">
          <circle cx={11} cy={11} r={7} />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          type="search"
          disabled
          autoComplete="off"
          placeholder="جستجو بین خدمات بیاوین... (به‌زودی)"
          style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: color.ink, fontSize: 13, fontFamily: font.family }}
        />
      </label>

      <style>{`
        .biawin-app-header{
          position:sticky;top:0;z-index:50;
          display:grid;grid-template-columns:auto auto minmax(0,1fr);
          align-items:center;gap:14px;padding:14px 18px;
          background:rgba(255,255,255,.92);border-bottom:1px solid rgba(8,121,220,.08);
          backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
          font-family:${font.family};
        }
        .biawin-app-header-brand{display:flex;align-items:center;gap:9px;min-width:max-content;text-decoration:none}
        .biawin-app-header-brand-mark{
          width:42px;height:42px;border-radius:15px;position:relative;overflow:hidden;flex:0 0 auto;
          background:linear-gradient(145deg, ${color.primary}, ${color.deep});
          box-shadow:0 9px 22px rgba(8,121,220,.24);
        }
        .biawin-app-header-brand-text{display:flex;flex-direction:column;line-height:1}
        .biawin-app-header-guide{
          height:42px;border:1px solid #d9e9f7;border-radius:14px;background:${color.white};color:#075aa8;
          padding:0 12px;display:flex;align-items:center;justify-content:center;gap:7px;
          font-size:10px;font-weight:800;white-space:nowrap;
          box-shadow:0 8px 20px rgba(8,121,220,.08);cursor:not-allowed;opacity:.7;
        }
        .biawin-app-header-search{
          height:46px;display:flex;align-items:center;gap:10px;
          border:1px solid #d9e9f7;background:#f7fbff;border-radius:16px;padding:0 14px;opacity:.75;
        }
        @media(max-width:620px){
          .biawin-app-header{grid-template-columns:auto minmax(0,1fr) auto;gap:8px;padding:10px 10px}
          .biawin-app-header-brand{justify-content:flex-start}
          .biawin-app-header-brand-mark{width:38px;height:38px;border-radius:14px}
          .biawin-app-header-brand-text{display:none}
          .biawin-app-header-guide{width:42px;height:42px;padding:0;border-radius:14px}
          .biawin-app-header-guide-text{display:none}
          .biawin-app-header-search{height:42px;min-width:0}
        }
      `}</style>
    </header>
  );
}

/** The two half-ring cutouts in `.brand-mark:before/:after` — replicated as real elements since React can't target a component's own pseudo-elements without a scoped stylesheet. */
function BrandMarkRings() {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 7,
          right: 12,
          width: 25,
          height: 25,
          border: "5px solid #fff",
          borderLeftColor: "transparent",
          borderRadius: 999,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 7,
          left: 12,
          width: 25,
          height: 25,
          border: "5px solid #fff",
          borderRightColor: "transparent",
          borderRadius: 999,
          opacity: 0.82,
        }}
      />
    </>
  );
}
