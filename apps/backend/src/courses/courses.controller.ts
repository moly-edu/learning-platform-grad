import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@repo/api-contract';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { CoursesService } from './courses.service';

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @TsRestHandler(contract.courses)
  async handler(@Session() session: UserSession) {
    return tsRestHandler(contract.courses, {
      getCourses: async ({ query }) => {
        try {
          const data = await this.coursesService.getCourses(
            query.organizationId,
            session.user.id,
          );
          return { status: 200, body: data };
        } catch (err: any) {
          if (err.message === 'Forbidden')
            return { status: 403, body: { error: 'Forbidden' } };
          return { status: 401, body: { error: err.message } };
        }
      },

      getCourseBySlug: async ({ params }) => {
        try {
          const data = await this.coursesService.getCourseBySlug(
            params.orgSlug,
            params.courseSlug,
            session.user.id,
          );
          return { status: 200, body: data };
        } catch (err: any) {
          if (err.message === 'Forbidden')
            return { status: 403, body: { error: 'Forbidden' } };
          return { status: 401, body: { error: err.message } };
        }
      },

      createCourse: async ({ body }) => {
        try {
          const data = await this.coursesService.createCourse(
            body.name,
            body.slug,
            body.organizationId,
            session.user.id,
            body.description,
          );
          return { status: 201, body: data };
        } catch (err: any) {
          if (err.message === 'Forbidden')
            return { status: 403, body: { error: 'Forbidden' } };
          return { status: 401, body: { error: err.message } };
        }
      },

      addLessonNode: async ({ params, body }) => {
        const result = await this.coursesService.addLessonNode({
          courseId: params.courseId,
          parentId: body.parentId,
          type: body.type as any,
          title: body.title,
          content: body.content,
        });
        return { status: 200, body: result };
      },

      updateLessonNode: async ({ params, body }) => {
        const result = await this.coursesService.updateLessonNode({
          nodeId: params.nodeId,
          courseId: params.courseId,
          title: body.title,
          content: body.content,
        });
        return { status: 200, body: result };
      },

      deleteLessonNode: async ({ params }) => {
        const result = await this.coursesService.deleteLessonNode({
          nodeId: params.nodeId,
          courseId: params.courseId,
        });
        return { status: 200, body: result };
      },

      reorderLessonNode: async ({ params, body }) => {
        const result = await this.coursesService.reorderLessonNode({
          nodeId: params.nodeId,
          courseId: params.courseId,
          targetParentId: body.targetParentId,
          targetIndex: body.targetIndex,
        });
        return { status: 200, body: result };
      },

      getHomeworkStatus: async ({ query }) => {
        const data = await this.coursesService.getHomeworkStatus(
          query.courseId,
          query.classId,
          session.user.id,
        );
        return { status: 200, body: data };
      },

      getHomeworkStatusForTeacher: async ({ query }) => {
        const data = await this.coursesService.getHomeworkStatusForTeacher(
          query.courseId,
          query.classId,
          query.studentId,
          session.user.id,
        );
        if (data.success === false && data.error?.includes('Forbidden')) {
          return { status: 403, body: { error: data.error } };
        }
        return { status: 200, body: data };
      },

      getAllStudentsHomeworkSummary: async ({ query }) => {
        const data = await this.coursesService.getAllStudentsHomeworkSummary(
          query.courseId,
          query.classId,
          session.user.id,
        );
        if (data.success === false && data.error?.includes('Forbidden')) {
          return { status: 403, body: { error: data.error } };
        }
        return { status: 200, body: data };
      },

      canCreateCourse: async ({ query }) => {
        const data = await this.coursesService.canCreateCourse(
          query.orgId,
          session.user.id,
        );
        return {
          status: 200,
          body: { success: data.success, error: data.error ?? undefined },
        };
      },
    });
  }
}
