import type { HTMLAttributes, ReactNode } from "react";
import { color, radius, shadow } from "../tokens";

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Centered dialog (prototype's `.auth-modal` / `.advisor-detail-modal`). */
export function Modal({ open, onClose, children, style, ...props }: ModalProps) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,47,77,.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 300,
      }}
    >
      <div
        {...props}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 420px)",
          background: color.white,
          borderRadius: radius.xl,
          boxShadow: shadow.md,
          padding: 24,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
