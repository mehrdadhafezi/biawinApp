import { adminTokenStorage } from "./auth/admin-token-storage";

// No hardcoded localhost fallback — same "fail fast" philosophy as
// apps/web's api-client.ts and the backend's env.validation.ts.
const API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL;
if (!API_URL) {
  throw new Error(
    "NEXT_PUBLIC_ADMIN_API_URL is not set. Copy apps/admin/.env.example to apps/admin/.env.local for development.",
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

/**
 * Refreshes against `/admin/auth/refresh` — never the customer
 * `/auth/refresh` endpoint. A single silent-refresh-then-retry on 401,
 * mirroring apps/web's api-client.ts exactly (see that file for why: one
 * shared in-flight refresh promise avoids a thundering herd of parallel
 * refresh calls when several requests 401 at once).
 */
async function refreshTokens(): Promise<boolean> {
  const refreshToken = adminTokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/admin/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    adminTokenStorage.clear();
    return false;
  }
  const body = (await res.json()) as SuccessBody<{ accessToken: string; refreshToken: string }>;
  adminTokenStorage.setTokens(body.data.accessToken, body.data.refreshToken);
  return true;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header — for pre-auth endpoints (login, refresh). */
  public?: boolean;
  /** Internal: prevents infinite retry loops after a refresh attempt. */
  _isRetry?: boolean;
}

/** Shared 401-retry-once + `{success, data}`/`{success, error}` envelope handling for both JSON and multipart requests. */
async function handleResponse<T>(
  res: Response,
  retry: (isRetry: true) => Promise<T>,
  isPublic: boolean,
  isRetry: boolean,
): Promise<T> {
  if (res.status === 401 && !isPublic && !isRetry) {
    refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) return retry(true);
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as SuccessBody<T> | ErrorBody;
  if (!body.success) {
    throw new ApiError(body.error.message, body.error.code, res.status);
  }
  return body.data;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options.public) {
    const accessToken = adminTokenStorage.getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return handleResponse<T>(
    res,
    () => request<T>(path, { ...options, _isRetry: true }),
    Boolean(options.public),
    Boolean(options._isRetry),
  );
}

/**
 * Multipart upload (media files) — deliberately not `request()`: a
 * `FormData` body must never get `JSON.stringify`'d or forced to
 * `Content-Type: application/json` (the browser sets the correct
 * multipart boundary itself when `Content-Type` is left unset on a
 * `FormData` body). Shares the same auth-header + single-retry-on-401
 * behavior via `handleResponse`.
 */
async function requestFormData<T>(path: string, formData: FormData, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {};
  const accessToken = adminTokenStorage.getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: formData });

  return handleResponse<T>(res, () => requestFormData<T>(path, formData, true), false, isRetry);
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>(path, formData),
};
