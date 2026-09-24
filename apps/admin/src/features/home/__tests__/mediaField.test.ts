import { clearMedia, initMediaField, mediaPayloadValue, selectMedia } from "../mediaField";

const OLD = "11111111-1111-4111-8111-111111111111";
const NEW = "22222222-2222-4222-8222-222222222222";

describe("initMediaField", () => {
  it("no reference: value null, not unavailable", () => {
    expect(initMediaField(undefined)).toEqual({ value: null, unavailable: false, resolved: false });
    expect(initMediaField({ mediaAssetId: null, image: null })).toEqual({ value: null, unavailable: false, resolved: false });
  });

  it("a reference whose image resolves is available", () => {
    expect(initMediaField({ mediaAssetId: OLD, image: "https://api/media/x.webp" })).toEqual({ value: OLD, unavailable: false, resolved: false });
  });

  it("a reference with image === null (soft-deleted asset) is flagged unavailable", () => {
    expect(initMediaField({ mediaAssetId: OLD, image: null })).toEqual({ value: OLD, unavailable: true, resolved: false });
  });
});

describe("mediaPayloadValue — a stale reference is never silently re-submitted", () => {
  it("unresolved unavailable reference is OMITTED (undefined) so the backend leaves it unchanged and does not 422", () => {
    const state = initMediaField({ mediaAssetId: OLD, image: null });
    expect(mediaPayloadValue(state)).toBeUndefined();
    // and it disappears from the JSON body entirely
    expect(JSON.stringify({ kicker: "k", mediaAssetId: mediaPayloadValue(state) })).toBe('{"kicker":"k"}');
  });

  it("choosing a replacement sends the NEW valid id (and never the old one)", () => {
    const state = selectMedia(NEW);
    expect(mediaPayloadValue(state)).toBe(NEW);
  });

  it("explicitly clearing sends null", () => {
    expect(mediaPayloadValue(clearMedia())).toBeNull();
  });

  it("an available reference is sent as-is; no reference sends null", () => {
    expect(mediaPayloadValue(initMediaField({ mediaAssetId: OLD, image: "https://api/media/x.webp" }))).toBe(OLD);
    expect(mediaPayloadValue(initMediaField(undefined))).toBeNull();
  });
});
