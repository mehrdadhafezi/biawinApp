import { ALL_HERO_KEYS, heroKeyAvailability } from "../heroKeys";

describe("heroKeyAvailability", () => {
  it("create: offers only keys nobody holds", () => {
    expect(heroKeyAvailability("create", ["earn"])).toEqual({ available: ["biawin", "reward"], exhausted: false });
    expect(heroKeyAvailability("create", [])).toEqual({ available: ALL_HERO_KEYS, exhausted: false });
  });

  it("create: when every key is taken nothing is offered and the form is exhausted (no fabricated enum value)", () => {
    const result = heroKeyAvailability("create", ["earn", "biawin", "reward"]);
    expect(result).toEqual({ available: [], exhausted: true });
    expect(ALL_HERO_KEYS).toEqual(["earn", "biawin", "reward"]);
  });

  it("edit: the row's own key stays selectable, taken keys of OTHER rows do not", () => {
    expect(heroKeyAvailability("edit", ["biawin", "reward"], "earn")).toEqual({ available: ["earn"], exhausted: false });
    expect(heroKeyAvailability("edit", ["reward"], "earn").available).toEqual(["earn", "biawin"]);
  });

  it("edit is never 'exhausted'", () => {
    expect(heroKeyAvailability("edit", ["biawin", "reward"], "earn").exhausted).toBe(false);
  });
});
