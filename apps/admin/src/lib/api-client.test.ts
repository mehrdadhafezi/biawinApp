import { ApiError, apiClient } from "./api-client";

/**
 * Stage 5.17-B: `ApiError` used to drop the backend's structured
 * `error.details`. These tests drive the real `apiClient` with a mocked
 * `fetch` to prove `details` now survives (e.g. media-delete 409
 * `references`, reorder 422 `unknownIds`).
 */
function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("ApiError details", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it("preserves error.details from the envelope on a 409", async () => {
    mockFetchOnce(409, {
      success: false,
      error: { code: "CONFLICT", message: "in use", details: { references: { homeNewsArticles: 1 } } },
    });
    const error = await apiClient.delete("/admin/media/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.code).toBe("CONFLICT");
    expect(apiError.details).toEqual({ references: { homeNewsArticles: 1 } });
  });

  it("preserves unknownIds on a 422", async () => {
    mockFetchOnce(422, { success: false, error: { code: "UNPROCESSABLE_ENTITY", message: "m", details: { unknownIds: ["a"] } } });
    const error = (await apiClient.patch("/admin/home/news-articles/reorder", { items: [] }).catch((e: unknown) => e)) as ApiError;
    expect(error.details).toEqual({ unknownIds: ["a"] });
  });

  it("details is undefined when the backend sent none (existing behavior unchanged)", async () => {
    mockFetchOnce(404, { success: false, error: { code: "NOT_FOUND", message: "missing" } });
    const error = (await apiClient.get("/admin/home/news-articles/x").catch((e: unknown) => e)) as ApiError;
    expect(error.message).toBe("missing");
    expect(error.details).toBeUndefined();
  });
});
