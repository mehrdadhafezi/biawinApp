"use client";

import { useState } from "react";
import { Button, Countdown, OtpInput, color, font } from "@biawin/ui";

export interface OtpStepProps {
  phone: string;
  expiresInSeconds: number;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  submitting: boolean;
}

export function OtpStep({ phone, expiresInSeconds, onSubmit, onResend, submitting }: OtpStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [countdownKey, setCountdownKey] = useState(0);

  async function handleSubmit() {
    if (code.length !== 6) {
      setError("کد ۶ رقمی را کامل وارد کنید.");
      return;
    }
    setError(null);
    await onSubmit(code);
  }

  async function handleResend() {
    setCode("");
    setCanResend(false);
    setCountdownKey((k) => k + 1);
    await onResend();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: font.family }}>
      <div>
        <small style={{ color: color.primary, fontWeight: 700, fontSize: 11 }}>تأیید شماره</small>
        <h3 style={{ margin: "4px 0", color: color.deep, fontSize: 20 }}>کد پیامکی رو وارد کن</h3>
        <p style={{ margin: 0, color: color.muted, fontSize: 12, lineHeight: 2 }}>
          کد ۶ رقمی به <b dir="ltr">{phone}</b> ارسال شد.
        </p>
      </div>
      <OtpInput value={code} onChange={setCode} disabled={submitting} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.muted }}>
        <span>ارسال دوباره کد</span>
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            style={{ border: 0, background: "transparent", color: color.primary, fontWeight: 700, cursor: "pointer", padding: 0 }}
          >
            ارسال مجدد
          </button>
        ) : (
          <Countdown key={countdownKey} seconds={expiresInSeconds} onComplete={() => setCanResend(true)} />
        )}
      </div>
      {error && <span style={{ color: "#c0392b", fontSize: 12 }}>{error}</span>}
      <Button type="button" disabled={submitting} onClick={handleSubmit}>
        {submitting ? "در حال بررسی..." : "تأیید و ادامه"}
      </Button>
    </div>
  );
}
