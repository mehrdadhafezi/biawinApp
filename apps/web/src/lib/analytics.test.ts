import { trackEvent } from "./analytics";

/**
 * SERVICES-R5.21 — analytics foundation. No real vendor is connected
 * (see analytics.ts's own doc comment) — this proves the typed event
 * contract itself: both required events exist, carry the real
 * categoryId/categoryCardId/targetServiceId/position fields, and the
 * function never throws for either shape (the real call sites —
 * `CategoryCardGrid`'s mount effect, the Category Landing page's click
 * handler — depend on this never being the thing that breaks a render).
 */
describe("trackEvent", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as { NODE_ENV: string }).NODE_ENV = originalEnv ?? "test";
  });

  it("accepts a CategoryCardViewed event without throwing", () => {
    expect(() =>
      trackEvent({
        name: "CategoryCardViewed",
        categoryId: "cat-1",
        categoryCardId: "card-1",
        targetServiceId: "svc-1",
        position: 0,
      }),
    ).not.toThrow();
  });

  it("accepts a CategoryCardClicked event without throwing", () => {
    expect(() =>
      trackEvent({
        name: "CategoryCardClicked",
        categoryId: "cat-1",
        categoryCardId: "card-1",
        targetServiceId: "svc-1",
        position: 2,
      }),
    ).not.toThrow();
  });

  it("logs to the console in non-production (the deliberate placeholder sink — see analytics.ts's own doc comment)", () => {
    (process.env as { NODE_ENV: string }).NODE_ENV = "development";
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});

    trackEvent({
      name: "CategoryCardClicked",
      categoryId: "cat-1",
      categoryCardId: "card-1",
      targetServiceId: "svc-1",
      position: 0,
    });

    expect(spy).toHaveBeenCalledWith(
      "[analytics]",
      "CategoryCardClicked",
      expect.objectContaining({ categoryId: "cat-1", categoryCardId: "card-1" }),
    );
    spy.mockRestore();
  });

  it("does not log in production (no real vendor is connected — see this file's own doc comment)", () => {
    (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});

    trackEvent({
      name: "CategoryCardViewed",
      categoryId: "cat-1",
      categoryCardId: "card-1",
      targetServiceId: "svc-1",
      position: 0,
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
