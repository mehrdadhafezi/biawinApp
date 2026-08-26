"use client";

import { color, font } from "@biawin/ui";

export interface ActiveToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Direct-write active/inactive toggle only — deliberately no Draft/
 * Published/Scheduled/Archived states (docs/admin-architecture-decision-
 * record.md's v1 scope explicitly chose direct-write + active toggle over
 * a publish workflow; Stage 5.20 doesn't introduce one at the UI layer
 * either).
 */
export function ActiveToggle({ active, onToggle, disabled, busy }: ActiveToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || busy}
      aria-pressed={active}
      className={`biawin-active-toggle${active ? " biawin-active-toggle--on" : ""}`}
    >
      {busy ? "…" : active ? "فعال" : "غیرفعال"}
      <style>{`
        .biawin-active-toggle{
          font-family:${font.family};font-size:11px;font-weight:800;border-radius:999px;
          padding:5px 12px;border:1px solid ${color.line};background:${color.ice};color:${color.muted};
          cursor:pointer;transition:background .15s ease,color .15s ease;white-space:nowrap;
        }
        .biawin-active-toggle:disabled{cursor:not-allowed;opacity:.6}
        .biawin-active-toggle--on{background:#e6f7ee;color:#1f9d55;border-color:#c9ecd9}
      `}</style>
    </button>
  );
}
