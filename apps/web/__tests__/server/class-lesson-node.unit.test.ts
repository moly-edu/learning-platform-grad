import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueLessonNodeMock, findUniqueWidgetBuildMock } = vi.hoisted(
  () => ({
    findUniqueLessonNodeMock: vi.fn(),
    findUniqueWidgetBuildMock: vi.fn(),
  }),
);

vi.mock("@/lib/prisma", () => ({
  default: {
    lessonNode: {
      findUnique: findUniqueLessonNodeMock,
    },
    widgetBuild: {
      findUnique: findUniqueWidgetBuildMock,
    },
  },
}));

vi.mock("@/lib/auth-server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getBuildRunIdFromLessonNode } from "@/server/class-lesson-node";

describe("getBuildRunIdFromLessonNode", () => {
  beforeEach(() => {
    findUniqueLessonNodeMock.mockReset();
    findUniqueWidgetBuildMock.mockReset();
  });

  it("returns null identifiers when lesson node has no content", async () => {
    findUniqueLessonNodeMock.mockResolvedValue(null);

    await expect(getBuildRunIdFromLessonNode("lesson-1")).resolves.toEqual({
      widgetId: null,
      buildRunId: null,
    });
    expect(findUniqueWidgetBuildMock).not.toHaveBeenCalled();
  });

  it("returns widgetId without buildRunId when no widgetBuildId is present", async () => {
    findUniqueLessonNodeMock.mockResolvedValue({
      content: {
        widgetId: "widget-1",
      },
    });

    await expect(getBuildRunIdFromLessonNode("lesson-1")).resolves.toEqual({
      widgetId: "widget-1",
      buildRunId: null,
    });
    expect(findUniqueWidgetBuildMock).not.toHaveBeenCalled();
  });

  it("resolves buildRunId from the selected widget build", async () => {
    findUniqueLessonNodeMock.mockResolvedValue({
      content: {
        widgetId: "widget-1",
        widgetBuildId: "build-1",
      },
    });
    findUniqueWidgetBuildMock.mockResolvedValue({
      buildRunId: "run-123",
    });

    await expect(getBuildRunIdFromLessonNode("lesson-1")).resolves.toEqual({
      widgetId: "widget-1",
      buildRunId: "run-123",
    });
    expect(findUniqueWidgetBuildMock).toHaveBeenCalledWith({
      where: {
        id: "build-1",
      },
      select: {
        buildRunId: true,
      },
    });
  });
});
