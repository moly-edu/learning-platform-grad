/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateWidget } from "@/components/widget/core/WidgetValidator";

describe("validateWidget", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns network error when widget fetch is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(validateWidget("https://widget.example")).resolves.toEqual({
      valid: false,
      error: "Không thể tải widget: 404 Not Found",
      errorType: "network",
    });
  });

  it("resolves valid when widget posts WIDGET_READY", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => "<html></html>",
    } as Response);

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "iframe") {
        const fakeIframe = originalCreateElement("div") as HTMLDivElement & {
          sandbox: { add: ReturnType<typeof vi.fn> };
          srcdoc: string;
        };
        fakeIframe.sandbox = { add: vi.fn() };
        fakeIframe.srcdoc = "";
        return fakeIframe as unknown as HTMLElement;
      }

      return originalCreateElement(tagName);
    });

    const originalAppendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const appended = originalAppendChild(node);
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "WIDGET_READY" },
          }),
        );
      }, 0);
      return appended;
    });

    await expect(validateWidget("https://widget.example")).resolves.toEqual({
      valid: true,
    });
  });

  it("returns cors error when fetch throws a TypeError", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("failed to fetch"));

    await expect(validateWidget("https://widget.example")).resolves.toEqual({
      valid: false,
      error:
        "Lỗi CORS: Server không cho phép truy cập từ domain này. Kiểm tra cấu hình CORS hoặc sử dụng URL khác",
      errorType: "cors",
    });
  });
});
