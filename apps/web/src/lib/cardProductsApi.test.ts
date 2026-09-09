import { cardProductsApi } from "./services-api";

const mockGet = jest.fn();
jest.mock("./api-client", () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
  ApiError: class ApiError extends Error {},
}));

/**
 * SERVICES-R5.18 — proves the two new customer-facing endpoints are
 * called exactly as the real backend contract requires (SERVICES-R5.16/
 * R5.17: `GET /cards`/`GET /cards/:id`, public, `status: 'ACTIVE'`
 * already enforced server-side — see `services-api.ts`'s own comment for
 * why no client-side re-filtering happens).
 */
describe("cardProductsApi", () => {
  beforeEach(() => mockGet.mockReset());

  it("listByService calls GET /cards with the real serviceId as a query param, marked public", async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
    await cardProductsApi.listByService("service-1");
    expect(mockGet).toHaveBeenCalledWith("/cards?serviceId=service-1&limit=100", { public: true });
  });

  it("getCardProduct calls GET /cards/:id, marked public", async () => {
    mockGet.mockResolvedValue({ id: "card-1" });
    await cardProductsApi.getCardProduct("card-1");
    expect(mockGet).toHaveBeenCalledWith("/cards/card-1", { public: true });
  });
});
