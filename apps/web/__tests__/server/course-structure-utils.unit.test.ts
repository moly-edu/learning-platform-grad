import { describe, expect, it } from "vitest";
import {
  addChildToNode,
  buildTreeFromFlatList,
  findNodeById,
  isDescendant,
  mergeLoadedChildren,
  moveNodeInTree,
  removeNodeFromTree,
  transformToUINode,
  updateNodeInTree,
} from "@/components/course-structure/utils/course-structure-utiles";
import { LessonNodeType, type LessonNodeUI, type LessonNodeWithCount } from "@/types/course";

function createFlatNode(
  id: string,
  type: LessonNodeType,
  parentId: string | null,
  order = 0,
): LessonNodeWithCount {
  const now = new Date("2026-05-19T00:00:00.000Z");

  return {
    id,
    title: id,
    type,
    content: {},
    order,
    parentId,
    courseId: "course-1",
    createdAt: now,
    updatedAt: now,
    _count: { children: 0 },
  };
}

function createUiNode(
  id: string,
  type: LessonNodeType,
  children: LessonNodeUI[] = [],
  parentId: string | null = null,
  order = 0,
): LessonNodeUI {
  return {
    ...createFlatNode(id, type, parentId, order),
    children,
    childrenLoaded: true,
    _count: { children: children.length },
  };
}

describe("course structure utils", () => {
  it("transformToUINode initializes empty children and unloaded state", () => {
    const node = createFlatNode("node-1", LessonNodeType.lesson, "parent-1");

    expect(transformToUINode(node)).toEqual({
      ...node,
      children: [],
      childrenLoaded: false,
    });
  });

  it("findNodeById returns nested node when present", () => {
    const tree = createUiNode("root", LessonNodeType.course, [
      createUiNode("child", LessonNodeType.module, [
        createUiNode("target", LessonNodeType.lesson, []),
      ], "root"),
    ]);

    expect(findNodeById(tree, "target")?.id).toBe("target");
  });

  it("updateNodeInTree immutably updates the target node only", () => {
    const tree = createUiNode("root", LessonNodeType.course, [
      createUiNode("child", LessonNodeType.module, []),
    ]);

    const updated = updateNodeInTree(tree, "child", (node) => ({
      ...node,
      title: "updated",
    }));

    expect(updated.children[0].title).toBe("updated");
    expect(tree.children[0].title).toBe("child");
  });

  it("removeNodeFromTree removes matching child and updates count", () => {
    const tree = createUiNode("root", LessonNodeType.course, [
      createUiNode("keep", LessonNodeType.module, [], "root"),
      createUiNode("remove", LessonNodeType.module, [], "root"),
    ]);

    const updated = removeNodeFromTree(tree, "remove");

    expect(updated.children.map((child) => child.id)).toEqual(["keep"]);
    expect(updated._count.children).toBe(1);
  });

  it("addChildToNode appends child and marks children as loaded", () => {
    const tree = createUiNode("root", LessonNodeType.course, []);
    const newChild = createUiNode("new", LessonNodeType.module, [], "root");

    const updated = addChildToNode(tree, "root", newChild);

    expect(updated.children.map((child) => child.id)).toEqual(["new"]);
    expect(updated.childrenLoaded).toBe(true);
    expect(updated._count.children).toBe(1);
  });

  it("isDescendant returns true for a nested descendant", () => {
    const tree = createUiNode("root", LessonNodeType.course, [
      createUiNode("module", LessonNodeType.module, [
        createUiNode("lesson", LessonNodeType.lesson, [], "module"),
      ], "root"),
    ]);

    expect(isDescendant(tree, "root", "lesson")).toBe(true);
  });

  it("isDescendant returns false when node is outside the branch", () => {
    const tree = createUiNode("root", LessonNodeType.course, [
      createUiNode("module", LessonNodeType.module, []),
    ]);

    expect(isDescendant(tree, "module", "missing")).toBe(false);
  });

  it("moveNodeInTree re-parents node and normalizes order", () => {
    const lesson = createUiNode("lesson", LessonNodeType.lesson, [], "module-a", 0);
    const moduleA = createUiNode("module-a", LessonNodeType.module, [lesson], "root", 0);
    const moduleB = createUiNode("module-b", LessonNodeType.module, [], "root", 1);
    const root = createUiNode("root", LessonNodeType.course, [moduleA, moduleB]);

    const updated = moveNodeInTree(root, "lesson", "module-b", 0);

    const updatedModuleA = findNodeById(updated, "module-a")!;
    const updatedModuleB = findNodeById(updated, "module-b")!;

    expect(updatedModuleA.children).toHaveLength(0);
    expect(updatedModuleB.children[0].id).toBe("lesson");
    expect(updatedModuleB.children[0].parentId).toBe("module-b");
    expect(updatedModuleB.children[0].order).toBe(0);
  });

  it("buildTreeFromFlatList builds parent-child relationships", () => {
    const root = createFlatNode("root", LessonNodeType.course, null);
    const module = createFlatNode("module", LessonNodeType.module, "root");
    const lesson = createFlatNode("lesson", LessonNodeType.lesson, "module");

    const tree = buildTreeFromFlatList([root, module, lesson]);

    expect(tree?.id).toBe("root");
    expect(tree?.children[0].id).toBe("module");
    expect(tree?.children[0].children[0].id).toBe("lesson");
  });

  it("mergeLoadedChildren replaces target children and marks them loaded", () => {
    const root = createUiNode("root", LessonNodeType.course, [
      createUiNode("module", LessonNodeType.module, [], "root"),
    ]);
    const loadedChildren = [createUiNode("lesson", LessonNodeType.lesson, [], "module")];

    const updated = mergeLoadedChildren(root, "module", loadedChildren);
    const module = findNodeById(updated, "module")!;

    expect(module.children.map((child) => child.id)).toEqual(["lesson"]);
    expect(module.childrenLoaded).toBe(true);
  });
});
