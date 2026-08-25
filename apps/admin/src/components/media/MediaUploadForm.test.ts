import { performMediaUpload } from "./MediaUploadForm";
import { ApiError } from "../../lib/api-client";

const FAKE_FILE = new File(["fake-bytes"], "photo.png", { type: "image/png" });
const FAKE_ASSET = {
  id: "asset-1",
  fileName: "photo.png",
  url: "/media/generated.png",
  mimeType: "image/png",
  sizeBytes: 10,
  width: 4,
  height: 3,
  altText: null,
  uploadedBy: "admin-1",
  createdAt: new Date().toISOString(),
};

describe("performMediaUpload", () => {
  it("uploads successfully: calls onUploaded with the created asset", async () => {
    const onUploaded = jest.fn();

    const result = await performMediaUpload(FAKE_FILE, "alt text", {
      upload: jest.fn().mockResolvedValue(FAKE_ASSET),
      onUploaded,
    });

    expect(result).toEqual({ success: true, asset: FAKE_ASSET });
    expect(onUploaded).toHaveBeenCalledWith(FAKE_ASSET);
  });

  it("rejects with no file selected, without calling the API", async () => {
    const upload = jest.fn();

    const result = await performMediaUpload(null, "", { upload, onUploaded: jest.fn() });

    expect(result).toEqual({ success: false, message: "لطفاً یک فایل انتخاب کنید." });
    expect(upload).not.toHaveBeenCalled();
  });

  it("surfaces the backend's real validation message on rejection (e.g. disallowed format)", async () => {
    const result = await performMediaUpload(FAKE_FILE, "", {
      upload: jest.fn().mockRejectedValue(new ApiError("فرمت فایل مجاز نیست.", "BAD_REQUEST", 400)),
      onUploaded: jest.fn(),
    });

    expect(result).toEqual({ success: false, message: "فرمت فایل مجاز نیست." });
  });

  it("falls back to a generic message for a non-ApiError failure (e.g. a network error)", async () => {
    const result = await performMediaUpload(FAKE_FILE, "", {
      upload: jest.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      onUploaded: jest.fn(),
    });

    expect(result).toEqual({ success: false, message: "خطای غیرمنتظره‌ای در آپلود رخ داد." });
  });

  it("omits altText from the upload call when left blank", async () => {
    const upload = jest.fn().mockResolvedValue(FAKE_ASSET);

    await performMediaUpload(FAKE_FILE, "", { upload, onUploaded: jest.fn() });

    expect(upload).toHaveBeenCalledWith(FAKE_FILE, undefined);
  });
});
