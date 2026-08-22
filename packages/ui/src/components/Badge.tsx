import type { HTMLAttributes } from "react";
import { color, font } from "../tokens";

export type BadgeTone = "info" | "success" | "warning" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  info: { bg: "#eaf6ff", fg: color.primary },
  success: { bg: "#e6f7ee", fg: "#1f9d55" },
  warning: { bg: "#fff4e5", fg: "#c65f11" },
  neutral: { bg: color.ice, fg: color.muted },
};

/** Small status/category label (prototype's payment-type badges: اقساطی/اعتباری/...). */
export function Badge({ tone = "info", style, ...props }: BadgeProps) {
  const { bg, fg } = tones[tone];
  return (
    <span
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: font.family,
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        padding: "4px 10px",
        background: bg,
        color: fg,
        ...style,
      }}
    />
  );
}
