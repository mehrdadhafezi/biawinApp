"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, color, font } from "@biawin/ui";

export interface ProfileStepProps {
  onSubmit: (input: { fullName: string; subscriptionCode?: string }) => Promise<void>;
  submitting: boolean;
}

/**
 * Only two fields — no email, no password (see docs/03-api.md). `subscriptionCode`
 * is optional and unrelated to authentication (it's handed off to the
 * membership domain server-side). Terms acceptance is a client-side-only gate
 * for now — see docs/07-security.md "future UserConsent model".
 */
export function ProfileStep({ onSubmit, submitting }: ProfileStepProps) {
  const [fullName, setFullName] = useState("");
  const [subscriptionCode, setSubscriptionCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      setError("نام و نام خانوادگی را وارد کنید.");
      return;
    }
    if (!termsAccepted) {
      setError("برای ادامه، پذیرش قوانین الزامی است.");
      return;
    }
    setError(null);
    await onSubmit({ fullName: fullName.trim(), subscriptionCode: subscriptionCode.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: font.family }}>
      <div>
        <small style={{ color: color.primary, fontWeight: 700, fontSize: 11 }}>آخرین مرحله</small>
        <h3 style={{ margin: "4px 0", color: color.deep, fontSize: 20 }}>حسابت رو کامل کن</h3>
        <p style={{ margin: 0, color: color.muted, fontSize: 12, lineHeight: 2 }}>
          فقط اطلاعات ضروری. اگر کد اشتراک داری واردش کن تا کیف پول و کارت‌های خریداری‌شده به حسابت متصل شوند.
        </p>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: color.ink }}>
        <span>نام و نام خانوادگی</span>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی" autoFocus />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: color.ink }}>
        <span>
          کد اشتراک <em style={{ color: color.muted }}>(اختیاری)</em>
        </span>
        <Input value={subscriptionCode} onChange={(e) => setSubscriptionCode(e.target.value)} placeholder="اگر اشتراک خریده‌اید" />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: color.muted }}>
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        <span>قوانین و شرایط استفاده از بیاوین را مطالعه کرده و می‌پذیرم.</span>
      </label>
      {error && <span style={{ color: "#c0392b", fontSize: 12 }}>{error}</span>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "در حال ثبت..." : "ورود به بیاوین"}
      </Button>
    </form>
  );
}
