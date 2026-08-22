import type { HTMLAttributes } from "react";
import { color, font } from "../tokens";

export interface FinancialCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  title: string;
  numberMasked: string;
  ownerLabel: string;
  accentFrom?: string;
  accentTo?: string;
}

/**
 * The bank-card-shaped visual used for membership/credit cards (prototype's
 * `.credit-card` / `.membership-card-face`). Real aspect ratio (1.62/1)
 * matches a physical card.
 */
export function FinancialCard({
  label,
  title,
  numberMasked,
  ownerLabel,
  accentFrom = color.primary,
  accentTo = color.deep,
  style,
  ...props
}: FinancialCardProps) {
  return (
    <div
      {...props}
      style={{
        position: "relative",
        aspectRatio: "1.62 / 1",
        borderRadius: 26,
        padding: 22,
        color: color.white,
        background: `linear-gradient(135deg, ${accentFrom} 0%, ${accentTo} 100%)`,
        boxShadow: "0 17px 45px rgba(4,79,152,.18)",
        fontFamily: font.family,
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 17, fontWeight: 800 }}>BiaWin</strong>
        <span style={{ fontSize: 11, opacity: 0.82 }}>{label}</span>
      </div>
      <div style={{ position: "absolute", insetInline: 22, top: "46%", transform: "translateY(-50%)" }}>
        <strong style={{ display: "block", fontSize: 22, fontWeight: 800 }}>{title}</strong>
      </div>
      <div style={{ position: "absolute", insetInline: 22, bottom: 20, display: "flex", justifyContent: "space-between" }}>
        <span style={{ direction: "ltr", letterSpacing: 2, fontSize: 12, fontWeight: 600 }}>{numberMasked}</span>
        <span style={{ fontSize: 10, opacity: 0.78 }}>{ownerLabel}</span>
      </div>
    </div>
  );
}
