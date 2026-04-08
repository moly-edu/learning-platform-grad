import { createNextHandler } from "@ts-rest/serverless/next";
import { contract } from "@repo/api-contract";

// ── Import existing server functions ───────────────────────
import {
  getUserClasses,
  getClassWithCourse,
  createClass,
  addClassMember,
  getClassStudents,
  getStudentPendingAssignments,
  getStudentPendingAssignmentsForClasses,
} from "@/server/classes";

import {
  getCourses,
  getCourseWithFullTreeBySlug,
  createCourse,
  canCreateCourse,
  addLessonNode,
  updateLessonNode,
  deleteLessonNode,
  reorderLessonNode,
  getStudentHomeworkStatusByClass,
  getStudentHomeworkStatusByClassForTeacher,
  getAllStudentsHomeworkSummary,
} from "@/server/courses";

import {
  loadClassLessonNode,
  getClassLessonNodeCounts,
  addClassLessonNode,
  deleteClassLessonNode,
  getBuildRunIdFromLessonNode,
  getAssignmentStatsBatch,
} from "@/server/class-lesson-node";

import {
  createClassGroup,
  deleteClassGroup,
  updateClassGroup,
  addMemberToGroup,
  removeMemberFromGroup,
} from "@/server/class-groups";

import { checkUserInOrg, addMember } from "@/server/members";
import { findUserByEmailAction } from "@/server/users";
import { getAllWidgets } from "@/server/widgets";
import { isAdmin } from "@/server/permissions";

// ── Helper: wrap server function calls that throw ──────────
async function safeCall<T>(
  fn: () => Promise<T>,
): Promise<
  { ok: true; data: T } | { ok: false; status: 401 | 403 | 500; error: string }
> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: any) {
    const msg = err?.message ?? "Internal server error";
    if (msg === "Unauthorized") return { ok: false, status: 401, error: msg };
    if (msg === "Forbidden") return { ok: false, status: 403, error: msg };
    console.error("[ts-rest handler]", msg);
    return { ok: false, status: 500, error: msg };
  }
}

// ── Handler ────────────────────────────────────────────────
const handler = createNextHandler(
  contract,
  {
    // ═══════════════════════════════════════════════════
    //  Health
    // ═══════════════════════════════════════════════════
    health: {
      check: async () => ({
        status: 200,
        body: { status: "ok" as const, timestamp: new Date().toISOString() },
      }),
    },

    // ═══════════════════════════════════════════════════
    //  Classes
    // ═══════════════════════════════════════════════════
    classes: {
      getUserClasses: async () => {
        const r = await safeCall(() => getUserClasses());
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      getClassWithCourse: async ({ params }) => {
        const r = await safeCall(() => getClassWithCourse(params.classId));
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      createClass: async ({ body }) => {
        const r = await safeCall(() =>
          createClass(body.name, body.courseId, body.organizationId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 201, body: r.data };
      },

      addClassMember: async ({ params, body }) => {
        const r = await safeCall(() =>
          addClassMember(params.classId, body.userId, body.role as any),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 201, body: r.data };
      },

      getClassStudents: async ({ params }) => {
        const r = await safeCall(() => getClassStudents(params.classId));
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      getStudentPendingAssignments: async ({ params }) => {
        const r = await safeCall(() =>
          getStudentPendingAssignments(params.classId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      getPendingAssignmentsBatch: async ({ body }) => {
        const r = await safeCall(() =>
          getStudentPendingAssignmentsForClasses(body.classIds),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Courses
    // ═══════════════════════════════════════════════════
    courses: {
      getCourses: async ({ query }) => {
        const r = await safeCall(() => getCourses(query.organizationId));
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      getCourseBySlug: async ({ params }) => {
        const r = await safeCall(() =>
          getCourseWithFullTreeBySlug(params.orgSlug, params.courseSlug),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      createCourse: async ({ body }) => {
        const r = await safeCall(() =>
          createCourse(
            body.name,
            body.slug,
            body.organizationId,
            body.description,
          ),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 201, body: r.data };
      },

      addLessonNode: async ({ params, body }) => {
        const result = await addLessonNode({
          courseId: params.courseId,
          parentId: body.parentId,
          type: body.type as any,
          title: body.title,
          content: body.content,
        });
        return { status: 200, body: result };
      },

      updateLessonNode: async ({ params, body }) => {
        const result = await updateLessonNode({
          nodeId: params.nodeId,
          courseId: params.courseId,
          title: body.title,
          content: body.content,
        });
        return { status: 200, body: result };
      },

      deleteLessonNode: async ({ params }) => {
        const result = await deleteLessonNode({
          nodeId: params.nodeId,
          courseId: params.courseId,
        });
        return { status: 200, body: result };
      },

      reorderLessonNode: async ({ params, body }) => {
        const result = await reorderLessonNode({
          nodeId: params.nodeId,
          courseId: params.courseId,
          targetParentId: body.targetParentId,
          targetIndex: body.targetIndex,
        });
        return { status: 200, body: result };
      },

      getHomeworkStatus: async ({ query }) => {
        const r = await safeCall(() =>
          getStudentHomeworkStatusByClass(query.courseId, query.classId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      getHomeworkStatusForTeacher: async ({ query }) => {
        const r = await safeCall(() =>
          getStudentHomeworkStatusByClassForTeacher(
            query.courseId,
            query.classId,
            query.studentId,
          ),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      getAllStudentsHomeworkSummary: async ({ query }) => {
        const r = await safeCall(() =>
          getAllStudentsHomeworkSummary(query.courseId, query.classId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      canCreateCourse: async ({ query }) => {
        const r = await safeCall(() => canCreateCourse(query.orgId));
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return {
          status: 200,
          body: { success: r.data.success, error: r.data.error ?? undefined },
        };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Class Lesson Nodes
    // ═══════════════════════════════════════════════════
    classLessonNodes: {
      loadClassLessonNode: async ({ query }) => {
        const r = await safeCall(() =>
          loadClassLessonNode(query.lessonNodeId, query.classId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data as any };
      },

      getClassLessonNodeCounts: async ({ body }) => {
        const result = await getClassLessonNodeCounts(
          body.lessonNodeIds,
          body.classId,
        );
        return { status: 200, body: result };
      },

      addClassLessonNode: async ({ body }) => {
        const result = await addClassLessonNode({
          lessonNodeId: body.lessonNodeId,
          classId: body.classId,
          type: body.type,
          content: body.content ?? {},
        });
        return { status: 201, body: result as any };
      },

      deleteClassLessonNode: async ({ params, query }) => {
        const result = await deleteClassLessonNode({
          classLessonNodeId: params.classLessonNodeId,
          classId: query.classId,
        });
        return { status: 200, body: result };
      },

      getBuildRunId: async ({ params }) => {
        const result = await getBuildRunIdFromLessonNode(params.lessonNodeId);
        return { status: 200, body: result };
      },

      getAssignmentStatsBatch: async ({ params }) => {
        const result = await getAssignmentStatsBatch(params.classId);
        return { status: 200, body: result };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Class Groups
    // ═══════════════════════════════════════════════════
    classGroups: {
      createClassGroup: async ({ body }) => {
        const r = await safeCall(() =>
          createClassGroup(body.classId, body.name, body.description),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 201, body: r.data };
      },

      updateClassGroup: async ({ params, body }) => {
        const r = await safeCall(() =>
          updateClassGroup(
            body.classId,
            params.groupId,
            body.name,
            body.description,
          ),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      deleteClassGroup: async ({ params, query }) => {
        const r = await safeCall(() =>
          deleteClassGroup(query.classId, params.groupId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: { success: true as const } };
      },

      addMemberToGroup: async ({ params, body }) => {
        const r = await safeCall(() =>
          addMemberToGroup(body.classId, params.groupId, body.userId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 201, body: r.data };
      },

      removeMemberFromGroup: async ({ params, query }) => {
        const r = await safeCall(() =>
          removeMemberFromGroup(query.classId, params.groupId, params.userId),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: { success: true as const } };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Members
    // ═══════════════════════════════════════════════════
    members: {
      checkUserInOrg: async ({ query }) => {
        const input = query.orgId
          ? { orgId: query.orgId }
          : { orgSlug: query.orgSlug! };
        const r = await safeCall(() => checkUserInOrg(input));
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },

      addMember: async ({ body }) => {
        const r = await safeCall(() =>
          addMember(body.organizationId, body.userId, body.role as any),
        );
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 201, body: { success: true as const } };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Users
    // ═══════════════════════════════════════════════════
    users: {
      findByEmail: async ({ query }) => {
        const user = await findUserByEmailAction(query.email);
        return { status: 200, body: user };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Widgets
    // ═══════════════════════════════════════════════════
    widgets: {
      getAllWidgets: async () => {
        const widgets = await getAllWidgets();
        return { status: 200, body: widgets };
      },
    },

    // ═══════════════════════════════════════════════════
    //  Permissions
    // ═══════════════════════════════════════════════════
    permissions: {
      isAdmin: async () => {
        const r = await safeCall(() => isAdmin());
        if (!r.ok) return { status: r.status as any, body: { error: r.error } };
        return { status: 200, body: r.data };
      },
    },
  },
  {
    handlerType: "app-router",
    jsonQuery: true,
    responseValidation: false,
  },
);

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
