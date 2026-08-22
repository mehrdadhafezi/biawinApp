import type { ButtonHTMLAttributes } from "react";
import { color, font } from "../tokens";

export interface StoryCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  ringFrom?: string;
  ringTo?: string;
}

/** Instagram-style story bubble used for intro topics / membership card stories. */
export function StoryCard({ title, ringFrom = color.primary, ringTo = "#4da5ff", style, children, ...props }: StoryCardProps) {
  return (
    <button
      {...props}
      style={{
        border: 0,
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        fontFamily: font.family,
        cursor: "pointer",
        ...style,
      }}
    >
      <span
        style={{
          width: 58,
          height: 58,
          borderRadius: "50%",
          padding: 3,
          background: `linear-gradient(145deg, ${ringFrom}, ${ringTo})`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <span
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: color.deep,
            border: `2px solid ${color.white}`,
            display: "grid",
            placeItems: "center",
            color: color.white,
          }}
        >
          {children}
        </span>
      </span>
      <span style={{ fontSize: 8.5, fontWeight: 700, color: color.deep }}>{title}</span>
    </button>
  );
}
