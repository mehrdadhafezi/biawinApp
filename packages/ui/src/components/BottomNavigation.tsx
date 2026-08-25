import type { ReactNode } from "react";
import { color, font, layout } from "../tokens";

export interface BottomNavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

export interface BottomNavigationProps {
  items: BottomNavItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

/**
 * The 4-tab bottom nav (بیاوین/خدمات/جایزه/پروفایل) — pixel-matched to
 * `<nav class="app-bottom-nav">` in `biawin_single_file_app_requested_edits_v15.html`
 * (the pixel-perfect Home migration's source of truth), not just the
 * general shape docs/01-prototype-analysis.md §2 described.
 *
 * Stage 5.14.1 fix: live-staging QA (`fixed bottom nav correct` /
 * `content not hidden behind bottom nav`) found this nav was NOT actually
 * pinned to the screen — it scrolled away with page content and only
 * appeared once scrolled all the way to a page's bottom. Root cause:
 * `AppShell` wraps every page in a `transform:translateZ(0)` column
 * (intentional — it caps `position:fixed` descendants to the 760px
 * mobile-shell column instead of the full browser window, Stage 5.1).
 * But a `transform` on an ancestor makes it the *containing block* for
 * `position:fixed` descendants, so this `nav` was really resolving
 * `bottom:0` against that column's full (content-height) box, not the
 * viewport — i.e. behaving like `position:absolute` pinned to the
 * bottom of the *page*, not the bottom of the *screen*. `GlobalHeader`
 * hit the identical trap and already solves it with `position:sticky`
 * (confirmed via live measurement: header stays at `top:0` across
 * scroll; this nav's `top` shifted 1:1 with `scrollY` before this fix).
 * `position:sticky` isn't subject to the fixed-positioning containing-
 * block rule, so it resolves against the transformed column exactly
 * like `relative`/`absolute` do — matching `GlobalHeader`'s fix.
 */
export function BottomNavigation({ items, activeKey, onChange }: BottomNavigationProps) {
  return (
    <nav
      style={{
        position: "sticky",
        insetInline: 0,
        bottom: 0,
        zIndex: 200,
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        background: "rgba(255,255,255,.98)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(8,121,220,.12)",
        boxShadow: "0 -10px 30px rgba(8,121,220,.09)",
        padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
        fontFamily: font.family,
        minHeight: layout.bottomNavHeight,
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              border: 0,
              background: active ? "#eaf6ff" : "transparent",
              color: active ? color.primary : "#73879a",
              display: "grid",
              placeItems: "center",
              gap: 5,
              padding: "6px 4px",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 16,
              cursor: "pointer",
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
