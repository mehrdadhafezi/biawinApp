import type { HTMLAttributes, ReactNode } from "react";
import { color, radius } from "../tokens";

export interface BottomSheetProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Slide-up sheet used for confirmations/purchase summaries (prototype's `.purchase-sheet`). */
export function BottomSheet({ open, onClose, children, style, ...props }: BottomSheetProps) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,47,77,.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 300,
      }}
    >
      <div
        {...props}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 760px)",
          background: color.white,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: "10px 20px 24px",
          ...style,
        }}
      >
        <div
          aria-hidden
          style={{ width: 40, height: 4, borderRadius: 999, background: color.line, margin: "0 auto 14px" }}
        />
        {children}
      </div>
    </div>
  );
}
