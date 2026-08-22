import { color, font, radius, shadow } from "../tokens";

export interface ToastProps {
  message: string;
  open: boolean;
  tone?: "default" | "error";
}

/** Bottom transient message (prototype's `.membership-toast` / `.detail-toast`). Purely presentational — the caller owns timing/auto-dismiss. */
export function Toast({ message, open, tone = "default" }: ToastProps) {
  if (!open) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 24,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 400,
      }}
    >
      <div
        style={{
          fontFamily: font.family,
          fontSize: 13,
          fontWeight: 700,
          color: color.white,
          background: tone === "error" ? "#c0392b" : color.deep,
          borderRadius: radius.md,
          padding: "10px 18px",
          boxShadow: shadow.md,
          maxWidth: "min(90%, 420px)",
          textAlign: "center",
        }}
      >
        {message}
      </div>
    </div>
  );
}
