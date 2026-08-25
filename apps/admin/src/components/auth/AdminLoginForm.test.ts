import { performAdminLogin } from "./AdminLoginForm";
import { ApiError } from "../../lib/api-client";

const CREDENTIALS = { email: "admin@biawin.ir", password: "correct-password" };
const TOKENS = { accessToken: "access-token", refreshToken: "refresh-token", expiresIn: 600 };

describe("performAdminLogin", () => {
  it("succeeds: stores the returned tokens and signals success", async () => {
    const onAuthenticated = jest.fn();
    const onSuccess = jest.fn();

    const result = await performAdminLogin(CREDENTIALS, {
      login: jest.fn().mockResolvedValue(TOKENS),
      onAuthenticated,
      onSuccess,
    });

    expect(result).toEqual({ success: true });
    expect(onAuthenticated).toHaveBeenCalledWith(TOKENS);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("fails with the server's message on invalid credentials, and never signals success", async () => {
    const onAuthenticated = jest.fn();
    const onSuccess = jest.fn();

    const result = await performAdminLogin(CREDENTIALS, {
      login: jest.fn().mockRejectedValue(new ApiError("ایمیل یا رمز عبور نادرست است.", "UNAUTHORIZED", 401)),
      onAuthenticated,
      onSuccess,
    });

    expect(result).toEqual({ success: false, message: "ایمیل یا رمز عبور نادرست است." });
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a non-ApiError failure (e.g. a network error)", async () => {
    const result = await performAdminLogin(CREDENTIALS, {
      login: jest.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      onAuthenticated: jest.fn(),
      onSuccess: jest.fn(),
    });

    expect(result).toEqual({ success: false, message: "خطای غیرمنتظره‌ای رخ داد." });
  });
});
