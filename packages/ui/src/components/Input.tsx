import type { InputHTMLAttributes } from "react";
import { color, font, radius } from "../tokens";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Base text input (prototype's `.search-box input` / `.unified-field input`). */
export function Input({ style, ...props }: InputProps) {
  return (
    <input
      {...props}
      style={{
        height: 46,
        width: "100%",
        border: `1px solid ${color.line}`,
        background: color.ice,
        borderRadius: radius.md,
        padding: "0 14px",
        fontFamily: font.family,
        // 16px minimum, not the prototype's 13px — iOS Safari auto-zooms
        // the page on focus for any input with a computed font-size under
        // 16px, which is what was causing the pinch-to-recover-scale bug.
        fontSize: 16,
        color: color.ink,
        outline: "none",
        ...style,
      }}
    />
  );
}
