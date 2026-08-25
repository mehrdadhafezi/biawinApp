"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminLoginInput, AuthTokens } from "@biawin/types";
import { Button, Input, color, font } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { adminAuthApi } from "../../lib/auth/admin-auth-api";
import { useAdminAuth } from "../../lib/auth/admin-auth-context";

export type AdminLoginResult = { success: true } | { success: false; message: string };

export interface PerformAdminLoginDeps {
  login: (input: AdminLoginInput) => Promise<AuthTokens>;
  onAuthenticated: (tokens: AuthTokens) => void;
  onSuccess: () => void;
}

/**
 * The actual submit-handler logic, factored out as a plain async function
 * so "successful login" and "failed login" are directly unit-testable
 * without rendering a form or simulating typing/clicking (see
 * AdminLoginForm.test.ts — the npm registry was unreachable for
 * `@testing-library/user-event`/`jest-environment-jsdom` for the entire
 * implementation window). Mirrors apps/web's `AuthModal`'s
 * `withErrorHandling` pattern (`ApiError` → its message, anything else →
 * a generic one) — the component below just owns the loading/error UI
 * state around this call.
 */
export async function performAdminLogin(input: AdminLoginInput, deps: PerformAdminLoginDeps): Promise<AdminLoginResult> {
  try {
    const tokens = await deps.login(input);
    deps.onAuthenticated(tokens);
    deps.onSuccess();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof ApiError ? error.message : "خطای غیرمنتظره‌ای رخ داد.",
    };
  }
}

/** Email+password login (docs/admin-architecture-decision-record.md §3) — calls `/admin/auth/login` directly, never the customer OTP flow. */
export function AdminLoginForm() {
  const router = useRouter();
  const { setAuthenticated } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const result = await performAdminLogin(
      { email, password },
      {
        login: adminAuthApi.login,
        onAuthenticated: setAuthenticated,
        onSuccess: () => router.push("/dashboard"),
      },
    );

    if (!result.success) setErrorMessage(result.message);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="biawin-admin-login-form" noValidate>
      <label className="biawin-admin-login-field">
        <span>ایمیل</span>
        <Input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="biawin-admin-login-field">
        <span>رمز عبور</span>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {errorMessage && (
        <p role="alert" className="biawin-admin-login-error">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
        {submitting ? "در حال ورود…" : "ورود"}
      </Button>

      <style>{`
        .biawin-admin-login-form{display:flex;flex-direction:column;gap:16px;font-family:${font.family}}
        .biawin-admin-login-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-admin-login-error{margin:0;font-size:12px;font-weight:700;color:#c0392b}
      `}</style>
    </form>
  );
}
