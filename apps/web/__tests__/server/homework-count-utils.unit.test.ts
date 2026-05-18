import { describe, expect, it } from "vitest";
import {
  buildHomeworkCountsMap,
  countHomeworksRecursive,
} from "@/components/course-structure/utils/homework-count-utils";
import { LessonNodeUI, LessonNodeType } from "@/types/course";

function createNode(
  id: string,
  type: LessonNodeType,
  children: LessonNodeUI[] = [],
): LessonNodeUI {
  const now = new Date("2026-05-18T00:00:00.000Z");

  return {
    id,
    title: id,
    type,
    content: {},
    order: 0,
    parentId: null,
    courseId: "course-1",
    createdAt: now,
    updatedAt: now,
    _count: {
      children: children.length,
    },
    children,
  };
}

describe("homework count utils", () => {
  it("counts assigned, pending, and correct homework recursively", () => {
    const tree = createNode("course-root", LessonNodeType.course, [
      createNode("module-1", LessonNodeType.module, [
        createNode("lesson-1", LessonNodeType.lesson, [
          createNode("hw-1", LessonNodeType.homework),
          createNode("hw-2", LessonNodeType.homework),
        ]),
      ]),
    ]);

    const result = countHomeworksRecursive(
      tree,
      { "hw-1": 3, "hw-2": 2 },
      { "hw-1": 1, "hw-2": 2 },
      { "hw-1": 1, "hw-2": 2 },
    );

    expect(result).toEqual({
      totalAssigned: 5,
      pending: 2,
      correct: 3,
    });
  });

  it("builds aggregate counts for every node in the tree", () => {
    const hw1 = createNode("hw-1", LessonNodeType.homework);
    const hw2 = createNode("hw-2", LessonNodeType.homework);
    const lesson = createNode("lesson-1", LessonNodeType.lesson, [hw1, hw2]);
    const module = createNode("module-1", LessonNodeType.module, [lesson]);
    const root = createNode("course-root", LessonNodeType.course, [module]);

    const counts = buildHomeworkCountsMap(
      root,
      { "hw-1": 1, "hw-2": 4 },
      { "hw-1": 1, "hw-2": 1 },
      { "hw-1": 1, "hw-2": 0 },
    );

    expect(counts.get("course-root")).toEqual({
      totalAssigned: 5,
      pending: 3,
      correct: 1,
    });
    expect(counts.get("module-1")).toEqual({
      totalAssigned: 5,
      pending: 3,
      correct: 1,
    });
    expect(counts.get("lesson-1")).toEqual({
      totalAssigned: 5,
      pending: 3,
      correct: 1,
    });
    expect(counts.get("hw-1")).toEqual({
      totalAssigned: 1,
      pending: 0,
      correct: 1,
    });
    expect(counts.get("hw-2")).toEqual({
      totalAssigned: 4,
      pending: 3,
      correct: 0,
    });
  });
});
