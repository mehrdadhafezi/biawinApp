"use client";

import { color } from "@biawin/ui";

export interface ReorderControlsProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabledUp?: boolean;
  disabledDown?: boolean;
  busy?: boolean;
}

/**
 * Move-up/move-down arrow buttons — the "simplest robust interaction"
 * choice over drag-and-drop (no drag/drop library is a dependency of this
 * repo, and adding one just for this would be exactly the unnecessary
 * framework Stage 5.20's brief warns against). Each click submits the full
 * recomputed order via the existing reorder API (`moveItem()` in
 * `logic.ts`), so the persisted order never depends on drag gesture
 * precision.
 */
export function ReorderControls({ onMoveUp, onMoveDown, disabledUp, disabledDown, busy }: ReorderControlsProps) {
  return (
    <div className="biawin-reorder-controls">
      <button type="button" aria-label="انتقال به بالا" onClick={onMoveUp} disabled={busy || disabledUp}>
        ▲
      </button>
      <button type="button" aria-label="انتقال به پایین" onClick={onMoveDown} disabled={busy || disabledDown}>
        ▼
      </button>
      <style>{`
        .biawin-reorder-controls{display:flex;flex-direction:column;gap:2px}
        .biawin-reorder-controls button{
          width:24px;height:20px;border:1px solid ${color.line};background:${color.white};
          color:${color.ink};border-radius:6px;font-size:9px;cursor:pointer;line-height:1;padding:0;
        }
        .biawin-reorder-controls button:hover:not(:disabled){background:${color.ice}}
        .biawin-reorder-controls button:disabled{opacity:.35;cursor:not-allowed}
      `}</style>
    </div>
  );
}
