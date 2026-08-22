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

/** The 4-tab bottom nav (خانه/خدمات/جایزه/پروفایل) — see docs/01-prototype-analysis.md §2. */
export function BottomNavigation({ items, activeKey, onChange }: BottomNavigationProps) {
  return (
    <nav
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        height: layout.bottomNavHeight,
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        background: "rgba(255,255,255,.98)",
        borderTop: `1px solid ${color.line}`,
        fontFamily: font.family,
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
              color: active ? color.primary : color.muted,
              display: "grid",
              placeItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              margin: 8,
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
