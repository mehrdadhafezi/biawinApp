"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal, Toast, color } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { authApi } from "../../lib/auth/auth-api";
import { useAuth } from "../../lib/auth/auth-context";
import { OtpStep } from "./OtpStep";
import { PhoneStep } from "./PhoneStep";
import { ProfileStep } from "./ProfileStep";

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = { name: "phone" } | { name: "otp"; phone: string; expiresInSeconds: number } | { name: "profile"; signupToken: string };

/** Orchestrates the unified Landing → Phone → OTP → Profile Completion → Home flow (docs/03-api.md). */
export function AuthModal({ open, onClose }: AuthModalProps) {
  const router = useRouter();
  const { setAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>({ name: "phone" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function reset() {
    setStep({ name: "phone" });
    setErrorMessage(null);
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function withErrorHandling(fn: () => Promise<void>) {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await fn();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "خطای غیرمنتظره‌ای رخ داد.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhoneSubmit(phone: string) {
    await withErrorHandling(async () => {
      const { expiresInSeconds } = await authApi.requestOtp(phone);
      setStep({ name: "otp", phone, expiresInSeconds });
    });
  }

  async function handleResend() {
    if (step.name !== "otp") return;
    await withErrorHandling(async () => {
      await authApi.requestOtp(step.phone);
    });
  }

  async function handleOtpSubmit(code: string) {
    if (step.name !== "otp") return;
    await withErrorHandling(async () => {
      const result = await authApi.verifyOtp(step.phone, code);
      if (result.status === "authenticated") {
        setAuthenticated(result);
        handleClose();
        router.push("/home");
      } else {
        setStep({ name: "profile", signupToken: result.signupToken });
      }
    });
  }

  async function handleProfileSubmit(input: { fullName: string; subscriptionCode?: string }) {
    if (step.name !== "profile") return;
    await withErrorHandling(async () => {
      const tokens = await authApi.completeSignup({ signupToken: step.signupToken, ...input });
      setAuthenticated(tokens);
      handleClose();
      router.push("/home");
    });
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
        {(["phone", "otp", "profile"] as const).map((name) => (
          <span
            key={name}
            style={{
              width: 24,
              height: 4,
              borderRadius: 999,
              background: step.name === name ? color.primary : color.line,
            }}
          />
        ))}
      </div>

      {step.name === "phone" && <PhoneStep onSubmit={handlePhoneSubmit} submitting={submitting} />}
      {step.name === "otp" && (
        <OtpStep
          phone={step.phone}
          expiresInSeconds={step.expiresInSeconds}
          onSubmit={handleOtpSubmit}
          onResend={handleResend}
          submitting={submitting}
        />
      )}
      {step.name === "profile" && <ProfileStep onSubmit={handleProfileSubmit} submitting={submitting} />}

      <Toast message={errorMessage ?? ""} open={Boolean(errorMessage)} tone="error" />
    </Modal>
  );
}
