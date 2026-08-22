import type { ID } from "./common";

/** Single value today — unified login/signup OTP flow (see docs/03-api.md). */
export type OtpPurpose = "auth";

export interface OtpChallenge {
  id: ID;
  phone: string;
  purpose: OtpPurpose;
  /** Never persisted/returned in plaintext outside the SMS provider call. */
  codeHash: string;
  expiresAt: string;
  attemptsRemaining: number;
  consumedAt: string | null;
}

export interface AuthSession {
  id: ID;
  userId: ID;
  /** Opaque refresh token id; the JWT access token itself is not persisted. */
  refreshTokenId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** POST /auth/otp/request */
export interface RequestOtpInput {
  phone: string;
}
export interface RequestOtpResult {
  expiresInSeconds: number;
}

/** POST /auth/otp/verify — no email/password anywhere. */
export interface VerifyOtpInput {
  phone: string;
  code: string;
}
export type VerifyOtpResult =
  | ({ status: "authenticated" } & AuthTokens)
  | { status: "signup_required"; signupToken: string };

/**
 * POST /auth/signup/complete — only these two fields (see docs/03-api.md).
 * `subscriptionCode` is not an auth credential: it is handed off to the
 * membership domain for real redemption/activation, never stored on `User`.
 */
export interface CompleteSignupInput {
  signupToken: string;
  fullName: string;
  subscriptionCode?: string;
}
