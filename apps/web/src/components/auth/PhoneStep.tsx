"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, color, font } from "@biawin/ui";

export interface PhoneStepProps {
  onSubmit: (phone: string) => Promise<void>;
  submitting: boolean;
}

const PHONE_PATTERN = /^09\d{9}$/;

export function PhoneStep({ onSubmit, submitting }: PhoneStepProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!PHONE_PATTERN.test(phone)) {
      setError("شماره موبایل را به‌صورت صحیح وارد کنید (۰۹xxxxxxxxx).");
      return;
    }
    setError(null);
    await onSubmit(phone);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: font.family }}>
      <div>
        <small style={{ color: color.primary, fontWeight: 700, fontSize: 11 }}>ورود و ثبت‌نام</small>
        <h3 style={{ margin: "4px 0", color: color.deep, fontSize: 20 }}>شماره موبایلت رو وارد کن</h3>
        <p style={{ margin: 0, color: color.muted, fontSize: 12, lineHeight: 2 }}>
          اگر قبلاً عضو بیاوین باشی وارد حسابت می‌شوی؛ اگر جدید باشی، ثبت‌نامت در چند ثانیه انجام می‌شود.
        </p>
      </div>
      <Input
        type="tel"
        inputMode="numeric"
        maxLength={11}
        placeholder="09xxxxxxxxx"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
        dir="ltr"
        style={{ textAlign: "left" }}
        autoFocus
      />
      {error && <span style={{ color: "#c0392b", fontSize: 12 }}>{error}</span>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "در حال ارسال..." : "دریافت کد ورود"}
      </Button>
    </form>
  );
}
