import type {
  AuthTokens,
  CompleteSignupInput,
  RequestOtpResult,
  VerifyOtpResult,
} from "@biawin/types";
import { apiClient } from "../api-client";

export const authApi = {
  requestOtp: (phone: string) =>
    apiClient.post<RequestOtpResult>("/auth/otp/request", { phone }, { public: true }),

  verifyOtp: (phone: string, code: string) =>
    apiClient.post<VerifyOtpResult>("/auth/otp/verify", { phone, code }, { public: true }),

  completeSignup: (input: CompleteSignupInput) =>
    apiClient.post<AuthTokens>("/auth/signup/complete", input, { public: true }),

  logout: (refreshToken: string) =>
    apiClient.post<void>("/auth/logout", { refreshToken }, { public: true }),
};
