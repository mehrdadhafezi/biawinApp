import { useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { color, font } from "../tokens";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** 6-box OTP entry (prototype's `.unified-otp`) — auto-focus, backspace/arrow nav, paste support. */
export function OtpInput({ length = 6, value, onChange, disabled }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < length - 1) inputsRef.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted.padEnd(value.length, ""));
    inputsRef.current[Math.min(pasted.length, length) - 1]?.focus();
  }

  return (
    <div style={{ display: "flex", gap: 8, direction: "ltr" }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          inputMode="numeric"
          maxLength={1}
          aria-label={`رقم ${index + 1}`}
          style={{
            width: 44,
            height: 52,
            textAlign: "center",
            fontSize: 20,
            fontFamily: font.family,
            fontWeight: 700,
            color: color.ink,
            border: `1px solid ${color.line}`,
            borderRadius: 12,
            background: color.ice,
            outline: "none",
          }}
        />
      ))}
    </div>
  );
}
