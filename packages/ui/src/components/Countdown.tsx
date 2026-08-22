import { useEffect, useState } from "react";
import { color, font } from "../tokens";

export interface CountdownProps {
  seconds: number;
  onComplete?: () => void;
}

function format(totalSeconds: number): string {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Resend-OTP countdown (prototype's `#unifiedResend`). Ticks down from `seconds` once, on mount/prop change. */
export function Countdown({ seconds, onComplete }: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  return (
    <span style={{ fontFamily: font.family, fontSize: 12, color: color.muted, direction: "ltr" }}>
      {format(Math.max(remaining, 0))}
    </span>
  );
}
