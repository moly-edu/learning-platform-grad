import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const coursesContract = c.router(
  {
    // ── GET /courses?organizationId=xxx ──────────────
    getCourses: {
      method: "GET",
      path: "/",
      query: z.object({
        organizationId: z.string(),
      }),
      responses: {
        200: c.type<any[]>(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
      summary: "Get all courses in an organization",
    },

    // ── GET /courses/by-slug/:orgSlug/:courseSlug ─────────────
    getCourseBySlug: {
      method: "GET",
      path: "/by-slug/:orgSlug/:courseSlug",
      pathParams: z.object({
        orgSlug: z.string(),
        courseSlug: z.string(),
      }),
      responses: {
        200: c.type<{
          success: boolean;
          data?: { course: any; nodes: any[] };
          role?: string;
          error?: string;
        }>(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
      summary: "Get course with full tree by slugs",
    },

    // ── POST /courses ────────────────────────────────
    createCourse: {
      method: "POST",
      path: "/",
      body: z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        organizationId: z.string(),
        description: z.string().optional(),
      }),
      responses: {
        201: c.type<any>(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
      summary: "Create a new course",
    },

    // ── POST /courses/:courseId/nodes ─────────────────
    addLessonNode: {
      method: "POST",
      path: "/:courseId/nodes",
      pathParams: z.object({
        courseId: z.string(),
      }),
      body: z.object({
        parentId: z.string(),
        type: z.enum(["module", "lesson", "homework"]),
        title: z.string().min(1),
        content: z.any().optional(),
      }),
      responses: {
        200: c.type<{ success: boolean; data?: any; error?: string }>(),
        401: z.object({ error: z.string() }),
      },
      summary: "Add a lesson node",
    },

    // ── PATCH /courses/:courseId/nodes/:nodeId ────────
    updateLessonNode: {
      method: "PATCH",
      path: "/:courseId/nodes/:nodeId",
      pathParams: z.object({
        courseId: z.string(),
        nodeId: z.string(),
      }),
      body: z.object({
        title: z.string().optional(),
        content: z.any().optional(),
      }),
      responses: {
        200: c.type<{ success: boolean; data?: any; error?: string }>(),
        401: z.object({ error: z.string() }),
      },
      summary: "Update a lesson node",
    },

    // ── DELETE /courses/:courseId/nodes/:nodeId ───────
    deleteLessonNode: {
      method: "DELETE",
      path: "/:courseId/nodes/:nodeId",
      pathParams: z.object({
        courseId: z.string(),
        nodeId: z.string(),
      }),
      body: z.never().optional() as any, // DELETE has no body
      responses: {
        200: c.type<{
          success: boolean;
          data?: { deletedId: string };
          error?: string;
        }>(),
        401: z.object({ error: z.string() }),
      },
      summary: "Delete a lesson node",
    },

    // ── PATCH /courses/:courseId/nodes/:nodeId/reorder ──
    reorderLessonNode: {
      method: "PATCH",
      path: "/:courseId/nodes/:nodeId/reorder",
      pathParams: z.object({
        courseId: z.string(),
        nodeId: z.string(),
      }),
      body: z.object({
        targetParentId: z.string(),
        targetIndex: z.number().int().min(0),
      }),
      responses: {
        200: c.type<{
          success: boolean;
          data?: {
            movedId: string;
            targetParentId: string;
            targetIndex: number;
          };
          error?: string;
        }>(),
        401: z.object({ error: z.string() }),
      },
      summary: "Move/reorder a lesson node",
    },

    // ── GET /courses/homework-status?courseId=x&classId=y ──
    getHomeworkStatus: {
      method: "GET",
      path: "/homework-status",
      query: z.object({
        courseId: z.string(),
        classId: z.string(),
      }),
      responses: {
        200: c.type<{
          success: boolean;
          data?: {
            assignedByLessonNode: Record<string, number>;
            submittedByLessonNode: Record<string, number>;
            correctByLessonNode: Record<string, number>;
            submissionsByAssignmentId: Record<string, any>;
          };
          error?: string;
        }>(),
        401: z.object({ error: z.string() }),
      },
      summary: "Get student homework status for a class",
    },

    // ── GET /courses/homework-status/teacher?courseId=x&classId=y&studentId=z
    getHomeworkStatusForTeacher: {
      method: "GET",
      path: "/homework-status/teacher",
      query: z.object({
        courseId: z.string(),
        classId: z.string(),
        studentId: z.string(),
      }),
      responses: {
        200: c.type<{
          success: boolean;
          data?: {
            assignedByLessonNode: Record<string, number>;
            submittedByLessonNode: Record<string, number>;
            correctByLessonNode: Record<string, number>;
            submissionsByAssignmentId: Record<string, any>;
          };
          error?: string;
        }>(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
      summary: "Teacher views a student's homework status",
    },

    // ── GET /courses/homework-summary?courseId=x&classId=y ──
    getAllStudentsHomeworkSummary: {
      method: "GET",
      path: "/homework-summary",
      query: z.object({
        courseId: z.string(),
        classId: z.string(),
      }),
      responses: {
        200: c.type<{
          success: boolean;
          data?: Record<string, { totalAssigned: number; correct: number }>;
          error?: string;
        }>(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
      summary: "Get homework summary for all students (teacher/owner)",
    },

    // ── GET /courses/can-create?orgId=xxx ────────────
    canCreateCourse: {
      method: "GET",
      path: "/can-create",
      query: z.object({
        orgId: z.string(),
      }),
      responses: {
        200: c.type<{ success: boolean; error?: string }>(),
        401: z.object({ error: z.string() }),
      },
      summary: "Check if user can create course in org",
    },
  },
  { pathPrefix: "/courses" },
);
