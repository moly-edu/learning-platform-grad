import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBuildRunIdFromLessonNodeMock } = vi.hoisted(() => ({
  getBuildRunIdFromLessonNodeMock: vi.fn(),
}));

vi.mock("@/server/class-lesson-node", () => ({
  getBuildRunIdFromLessonNode: getBuildRunIdFromLessonNodeMock,
}));

import { GET } from "@/app/api/class/assignment/route";

describe("GET /api/class/assignment", () => {
  beforeEach(() => {
    getBuildRunIdFromLessonNodeMock.mockReset();
  });

  it("returns 400 when lessonNodeId is missing", async () => {
    const response = await GET(new Request("http://localhost/api/class/assignment"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "lessonNodeId is required",
    });
  });

  it("returns 404 when no widget or build run is found", async () => {
    getBuildRunIdFromLessonNodeMock.mockResolvedValue({
      widgetId: null,
      buildRunId: null,
    });

    const response = await GET(
      new Request("http://localhost/api/class/assignment?lessonNodeId=lesson-1"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      widgetId: null,
      buildRunId: null,
      message: "Not found",
    });
  });

  it("returns widget and build identifiers when available", async () => {
    getBuildRunIdFromLessonNodeMock.mockResolvedValue({
      widgetId: "widget-1",
      buildRunId: "run-1",
    });

    const response = await GET(
      new Request("http://localhost/api/class/assignment?lessonNodeId=lesson-1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      widgetId: "widget-1",
      buildRunId: "run-1",
    });
  });

  it("returns 500 when the backing service throws", async () => {
    getBuildRunIdFromLessonNodeMock.mockRejectedValue(new Error("boom"));

    const response = await GET(
      new Request("http://localhost/api/class/assignment?lessonNodeId=lesson-1"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});
