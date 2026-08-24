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
 */
export function BottomNavigation({ items, activeKey, onChange }: BottomNavigationProps) {
  return (
    <nav
      style={{
        position: "fixed",
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
