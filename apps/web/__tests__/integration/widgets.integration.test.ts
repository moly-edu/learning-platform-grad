import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAllWidgetsMock } = vi.hoisted(() => ({
  getAllWidgetsMock: vi.fn(),
}));

vi.mock("@/server/widgets", () => ({
  getAllWidgets: getAllWidgetsMock,
}));

import { GET } from "@/app/api/widgets/route";

describe("GET /api/widgets", () => {
  beforeEach(() => {
    getAllWidgetsMock.mockReset();
  });

  it("returns all widgets from the server layer", async () => {
    getAllWidgetsMock.mockResolvedValue([
      { id: "widget-1", name: "Quiz Widget" },
      { id: "widget-2", name: "Code Widget" },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: "widget-1", name: "Quiz Widget" },
      { id: "widget-2", name: "Code Widget" },
    ]);
  });
});
