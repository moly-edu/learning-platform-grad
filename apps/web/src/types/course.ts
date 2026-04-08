import { Prisma } from "@repo/db";

export type LessonNodeWithCount = Prisma.LessonNodeGetPayload<{
  select: {
    id: true;
    title: true;
    type: true;
    content: true;
    order: true;
    parentId: true;
    courseId: true;
    createdAt: true;
    updatedAt: true;
    _count: {
      select: { children: true };
    };
  };
}>;

export type LessonNodeWithChildren = Prisma.LessonNodeGetPayload<{
  include: {
    children: {
      select: {
        id: true;
        title: true;
        type: true;
        content: true;
        order: true;
        parentId: true;
        courseId: true;
        createdAt: true;
        updatedAt: true;
        _count: {
          select: { children: true };
        };
      };
    };
  };
}>;

export type CourseWithRootNode = Prisma.CourseGetPayload<{
  include: {
    rootLessonNode: {
      include: {
        children: {
          orderBy: { order: "asc" };
          select: {
            id: true;
            title: true;
            type: true;
            content: true;
            order: true;
            parentId: true;
            courseId: true;
            createdAt: true;
            updatedAt: true;
            _count: {
              select: { children: true };
            };
          };
        };
        _count: {
          select: { children: true };
        };
      };
    };
  };
}>;

export type AddNodeInputType = Extract<
  LessonNodeType,
  "homework" | "module" | "lesson"
>;

export enum LessonNodeType {
  course = "course",
  module = "module",
  lesson = "lesson",
  homework = "homework",
}

export type LessonContent = {
  content?: string;
};

export type HomeworkContent = {
  widgetId?: string;
  widgetBuildId?: string | null;
};

export type LessonNodeContent = LessonContent | HomeworkContent;

export interface AddNodeInput {
  courseId: string;
  parentId: string;
  type: AddNodeInputType;
  title: string;
  content?: LessonNodeContent;
}

export interface DeleteNodeInput {
  nodeId: string;
  courseId: string;
}

export interface MoveNodeInput {
  nodeId: string;
  courseId: string;
  targetParentId: string;
  targetIndex: number;
}

export type LessonNodeUI = LessonNodeWithCount & {
  children: LessonNodeUI[];
  childrenLoaded?: boolean;
};

export type CourseUI = Omit<CourseWithRootNode, "rootLessonNode"> & {
  rootLessonNode:
    | (Omit<NonNullable<CourseWithRootNode["rootLessonNode"]>, "children"> & {
        children: LessonNodeUI[];
      })
    | null;
};
