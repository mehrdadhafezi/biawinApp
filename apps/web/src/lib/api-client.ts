import { tokenStorage } from "./auth/token-storage";

// No hardcoded localhost fallback — every environment (local dev, CI, staging,
// production) must set this explicitly (apps/web/.env.local for dev,
// docker-compose.yml for the containerized dev stack, deploy-time env for
// staging/production — see docs/04-deployment.md). Fail fast, same philosophy
// as the backend's env.validation.ts, rather than silently defaulting to a
// URL that's only ever correct on one developer's machine.
const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Copy apps/web/.env.example to apps/web/.env.local for development.",
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface SuccessBody<T> {
  success: true;
  data: T;
}
interface ErrorBody {
  success: false;
  error: { code: string; message: string };
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokenStorage.clear();
    return false;
  }
  const body = (await res.json()) as SuccessBody<{ accessToken: string; refreshToken: string }>;
  tokenStorage.setTokens(body.data.accessToken, body.data.refreshToken);
  return true;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header — for pre-auth endpoints (OTP, signup, refresh). */
  public?: boolean;
  /** Internal: prevents infinite retry loops after a refresh attempt. */
  _isRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options.public) {
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Single silent-refresh retry on 401 for authenticated requests.
  if (res.status === 401 && !options.public && !options._isRetry) {
    refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) return request<T>(path, { ...options, _isRetry: true });
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as SuccessBody<T> | ErrorBody;
  if (!body.success) {
    throw new ApiError(body.error.message, body.error.code, res.status);
  }
  return body.data;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
};
