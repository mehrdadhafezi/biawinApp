import type { HTMLAttributes } from "react";
import { color, radius, shadow } from "../tokens";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

/** Generic surface used across the app for grouped content. */
export function Card({ padded = true, style, ...props }: CardProps) {
  return (
    <div
      {...props}
      style={{
        background: color.white,
        border: `1px solid ${color.line}`,
        borderRadius: radius.xl,
        boxShadow: shadow.sm,
        padding: padded ? 18 : 0,
        ...style,
      }}
    />
  );
}
