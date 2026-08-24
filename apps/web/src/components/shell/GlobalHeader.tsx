import { color, font } from "@biawin/ui";
import { ComingSoonCaption } from "../common/ComingSoonCaption";

/**
 * The permanent app header — pixel-matched to `<header class="header">`
 * inside `.page-home` in `biawin_single_file_app_requested_edits_v15.html`
 * (the pixel-perfect Home migration's source of truth). The prototype
 * frames this as shell-level chrome ("Fixed Header ... same across
 * screens"), so — like `BottomNavigation` — it's the same on every page,
 * replacing Stage 5.2's per-page "سلام {firstName} / {pageLabel}" header
 * (`PageHeader.tsx`, now unused).
 *
 * The App Guide and search box have no backing feature yet (no guide
 * content, no search endpoint — docs/services-ui-contract.md §6 already
 * flagged search as MISSING) — both are real, `disabled` controls with a
 * visible "به‌زودی" caption, the same established pattern every other
 * unbuilt feature in this app uses, not a button that looks tappable and
 * silently does nothing.
 */
export function GlobalHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "grid",
        gridTemplateColumns: "auto auto minmax(0,1fr)",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        background: "rgba(255,255,255,.92)",
        borderBottom: "1px solid rgba(8,121,220,.08)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        fontFamily: font.family,
      }}
    >
      <a
        aria-label="بیاوین"
        href="/home"
        style={{ display: "flex", alignItems: "center", gap: 9, minWidth: "max-content", textDecoration: "none" }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            background: `linear-gradient(145deg, ${color.primary}, ${color.deep})`,
            position: "relative",
            boxShadow: "0 9px 22px rgba(8,121,220,.24)",
            overflow: "hidden",
            flex: "0 0 auto",
          }}
        >
          <BrandMarkRings />
        </span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <strong style={{ fontSize: 20, fontWeight: 800, color: color.deep, letterSpacing: "-.5px" }}>بیاوین</strong>
          <small style={{ fontSize: 9, color: color.primary, letterSpacing: 2, marginTop: 4 }}>BIAWIN</small>
        </span>
      </a>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <button
          type="button"
          disabled
          aria-label="راهنمای اپلیکیشن — به‌زودی"
          style={{
            height: 42,
            border: "1px solid #d9e9f7",
            borderRadius: 14,
            background: color.white,
            color: "#075aa8",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: "nowrap",
            boxShadow: "0 8px 20px rgba(8,121,220,.08)",
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
            <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z" />
          </svg>
          <span>راهنما</span>
        </button>
        <ComingSoonCaption />
      </div>

      <label
        style={{
          height: 46,
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid #d9e9f7",
          background: "#f7fbff",
          borderRadius: 16,
          padding: "0 14px",
          opacity: 0.75,
        }}
      >
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
