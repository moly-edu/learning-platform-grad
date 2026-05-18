import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getImageSizeFromBase64,
  isBase64Image,
  uploadBase64Image,
} from "@/lib/supabase/image-upload";

describe("image upload helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("detects base64 images correctly", () => {
    expect(isBase64Image("data:image/png;base64,AAAA")).toBe(true);
    expect(isBase64Image("https://example.com/image.png")).toBe(false);
  });

  it("calculates approximate image size from base64 payload", () => {
    expect(getImageSizeFromBase64("data:image/png;base64,QUJDRA==")).toBe(6);
  });

  it("uploads base64 image and returns uploaded url", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/a.png" }),
    } as Response);

    await expect(uploadBase64Image("data:image/png;base64,AAAA", "a.png")).resolves.toBe(
      "https://cdn.example.com/a.png",
    );
    expect(fetch).toHaveBeenCalledWith("/api/upload-widget-image", expect.objectContaining({
      method: "POST",
    }));
  });

  it("throws server error details when upload fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Upload failed badly" }),
    } as Response);

    await expect(
      uploadBase64Image("data:image/png;base64,AAAA"),
    ).rejects.toThrow("Upload failed badly");
  });
});
