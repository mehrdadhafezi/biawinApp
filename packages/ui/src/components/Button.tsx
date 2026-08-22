import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { color, font, radius } from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base: CSSProperties = {
  fontFamily: font.family,
  fontWeight: 700,
  fontSize: 14,
  borderRadius: radius.md,
  padding: "12px 20px",
  border: "1px solid transparent",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "opacity .15s ease, transform .15s ease",
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { background: color.primary, color: color.white },
  secondary: { background: color.ice, color: color.deep, borderColor: color.line },
  ghost: { background: "transparent", color: color.primary },
};

/** Base button — see docs/06-design-system.md. Feature-stage work adds loading/icon slots. */
export function Button({ variant = "primary", style, ...props }: ButtonProps) {
  return <button {...props} style={{ ...base, ...variants[variant], ...style }} />;
}
