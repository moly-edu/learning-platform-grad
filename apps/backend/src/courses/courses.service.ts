import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LessonNodeType } from '@repo/db';

type LessonNodeContent =
  | { content: string }
  | { widgetId: string; widgetVersion: string }
  | Record<string, any>;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCourses(organizationId: string, userId: string) {
    // Check membership
    const isMember = await this.prisma.member.findFirst({
      where: { userId, organization: { id: organizationId } },
    });
    if (!isMember) throw new Error('Forbidden');

    return this.prisma.course.findMany({
      where: { organizationId },
    });
  }

  async getCourseBySlug(orgSlug: string, courseSlug: string, userId: string) {
    try {
      const isMember = await this.prisma.member.findFirst({
        where: { userId, organization: { slug: orgSlug } },
        select: {
          userId: true,
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!isMember) throw new Error('Forbidden');

      const course = await this.prisma.course.findUnique({
        where: {
          organizationId_slug: {
            organizationId: isMember.organization.id,
            slug: courseSlug,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          organizationId: true,
          rootLessonNodeId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!course) {
        return { success: false, error: 'Course không tồn tại' };
      }

      const allNodes = await this.prisma.lessonNode.findMany({
        where: { courseId: course.id },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          order: true,
          parentId: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { children: true } },
        },
      });

      return {
        success: true,
        data: { course, nodes: allNodes },
        role: isMember.role,
      };
    } catch (error: any) {
      if (error.message === 'Forbidden') throw error;
      console.error('Error loading course with full tree by slug:', error);
      return {
        success: false,
        error: 'Có lỗi xảy ra khi lấy dữ liệu course',
      };
    }
  }

  async createCourse(
    name: string,
    slug: string,
    organizationId: string,
    userId: string,
    description?: string,
  ) {
    const isMember = await this.prisma.member.findFirst({
      where: { userId, organization: { id: organizationId } },
      select: {
        userId: true,
        role: true,
        organization: { select: { id: true } },
      },
    });

    if (!isMember) throw new Error('Forbidden');

    return this.prisma.$transaction(async (tx) => {
      const newCourse = await tx.course.create({
        data: {
          organizationId,
          name,
          slug,
          description,
          createdBy: isMember.userId,
        },
      });

      const rootNode = await tx.lessonNode.create({
        data: {
          type: LessonNodeType.course,
          title: name,
          content: {},
          courseId: newCourse.id,
        },
      });

      return tx.course.update({
        where: { id: newCourse.id },
        data: { rootLessonNodeId: rootNode.id },
        include: { rootLessonNode: true },
      });
    });
  }

  async addLessonNode(input: {
    courseId: string;
    parentId: string;
    type: string;
    title: string;
    content?: any;
  }) {
    try {
      const { courseId, parentId, type, title, content } = input;

      const parentNode = await this.prisma.lessonNode.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          type: true,
          _count: { select: { children: true } },
        },
      });

      if (!parentNode) {
        return { success: false, error: 'Parent node không tồn tại' };
      }

      if (type === LessonNodeType.homework) {
        if (parentNode.type !== LessonNodeType.lesson) {
          return {
            success: false,
            error: 'Chỉ có thể thêm Homework vào Lesson',
          };
        }
      } else {
        if (parentNode.type === LessonNodeType.lesson) {
          return {
            success: false,
            error: 'Không thể thêm node vào Lesson',
          };
        }
      }

      const order = parentNode._count.children;
      const finalContent =
        content ?? this.getDefaultContent(type as LessonNodeType);

      const newNode = await this.prisma.lessonNode.create({
        data: {
          title,
          type: type as LessonNodeType,
          courseId,
          parentId,
          order,
          content: finalContent,
        },
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          order: true,
          parentId: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { children: true } },
        },
      });

      return { success: true, data: newNode };
    } catch (error) {
      console.error('Error adding lesson node:', error);
      return { success: false, error: 'Có lỗi xảy ra khi thêm node' };
    }
  }

  private getDefaultContent(type: LessonNodeType): LessonNodeContent {
    switch (type) {
      case LessonNodeType.lesson:
        return { content: '' };
      case LessonNodeType.homework:
        return { widgetId: '', widgetVersion: '' };
      case LessonNodeType.module:
        return { content: '' };
      default:
        return {};
    }
  }

  async updateLessonNode(input: {
    nodeId: string;
    courseId: string;
    title?: string;
    content?: any;
  }) {
    try {
      const { nodeId, courseId, title, content } = input;

      const node = await this.prisma.lessonNode.findUnique({
        where: { id: nodeId },
        select: { courseId: true, type: true },
      });

      if (!node || node.courseId !== courseId) {
        return {
          success: false,
          error: 'Node không tồn tại hoặc không thuộc course này',
        };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { rootLessonNodeId: true },
      });

      if (course?.rootLessonNodeId === nodeId && title !== undefined) {
        return { success: false, error: 'Không thể đổi tên root course node' };
      }

      const updated = await this.prisma.lessonNode.update({
        where: { id: nodeId },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
        },
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          order: true,
          parentId: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { children: true } },
        },
      });

      return { success: true, data: updated };
    } catch (error) {
      console.error('Error updating lesson node:', error);
      return { success: false, error: 'Có lỗi xảy ra khi cập nhật node' };
    }
  }

  async deleteLessonNode(input: { nodeId: string; courseId: string }) {
    try {
      const { nodeId, courseId } = input;

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { rootLessonNodeId: true },
      });

      if (!course) {
        return { success: false, error: 'Course không tồn tại' };
      }

      if (course.rootLessonNodeId === nodeId) {
        return {
          success: false,
          error: 'Không thể xóa root node của course',
        };
      }

      const nodeToDelete = await this.prisma.lessonNode.findUnique({
        where: { id: nodeId },
        select: { id: true, courseId: true },
      });

      if (!nodeToDelete) {
        return { success: false, error: 'Node không tồn tại' };
      }

      if (nodeToDelete.courseId !== courseId) {
        return {
          success: false,
          error: 'Node không tồn tại hoặc không thuộc course này',
        };
      }

      const deletedResult = await this.prisma.$transaction(async (tx) => {
        const subtreeNodeIds: string[] = [nodeId];
        let frontierNodeIds: string[] = [nodeId];

        while (frontierNodeIds.length > 0) {
          const children = await tx.lessonNode.findMany({
            where: { parentId: { in: frontierNodeIds } },
            select: { id: true },
          });

          const childIds = children.map((child) => child.id);
          if (childIds.length === 0) break;

          subtreeNodeIds.push(...childIds);
          frontierNodeIds = childIds;
        }

        await tx.classLessonNode.deleteMany({
          where: { lessonNodeId: { in: subtreeNodeIds } },
        });

        await tx.autoAssignmentSchedule.deleteMany({
          where: { homeworkNodeId: { in: subtreeNodeIds } },
        });

        const deleted = await tx.lessonNode.deleteMany({
          where: { id: { in: subtreeNodeIds } },
        });

        return {
          deletedCount: deleted.count,
        };
      });

      return {
        success: true,
        data: {
          deletedId: nodeId,
          deletedCount: deletedResult.deletedCount,
        },
      };
    } catch (error) {
      console.error('Error deleting lesson node:', error);
      return { success: false, error: 'Có lỗi xảy ra khi xóa node' };
    }
  }

  async reorderLessonNode(input: {
    nodeId: string;
    courseId: string;
    targetParentId: string;
    targetIndex: number;
  }) {
    try {
      const { nodeId, courseId, targetParentId, targetIndex } = input;

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { rootLessonNodeId: true },
      });

      if (!course) {
        return { success: false, error: 'Course không tồn tại' };
      }

      if (course.rootLessonNodeId === nodeId) {
        return {
          success: false,
          error: 'Không thể di chuyển root node của course',
        };
      }

      const movedResult = await this.prisma.$transaction(async (tx) => {
        const movingNode = await tx.lessonNode.findUnique({
          where: { id: nodeId },
          select: {
            id: true,
            type: true,
            parentId: true,
            courseId: true,
          },
        });

        if (!movingNode || movingNode.courseId !== courseId) {
          throw new Error('NODE_NOT_FOUND_OR_INVALID_COURSE');
        }

        const targetParent = await tx.lessonNode.findUnique({
          where: { id: targetParentId },
          select: {
            id: true,
            type: true,
            courseId: true,
            parentId: true,
          },
        });

        if (!targetParent || targetParent.courseId !== courseId) {
          throw new Error('TARGET_PARENT_NOT_FOUND_OR_INVALID_COURSE');
        }

        if (targetParent.id === movingNode.id) {
          throw new Error('CANNOT_MOVE_NODE_INTO_ITSELF');
        }

        let cursorParentId: string | null = targetParent.parentId;
        while (cursorParentId) {
          if (cursorParentId === movingNode.id) {
            throw new Error('CANNOT_MOVE_NODE_INTO_DESCENDANT');
          }

          const cursor = await tx.lessonNode.findUnique({
            where: { id: cursorParentId },
            select: { parentId: true },
          });
          cursorParentId = cursor?.parentId ?? null;
        }

        if (movingNode.type === LessonNodeType.homework) {
          if (targetParent.type !== LessonNodeType.lesson) {
            throw new Error('HOMEWORK_MUST_BE_UNDER_LESSON');
          }
        } else if (targetParent.type === LessonNodeType.lesson) {
          throw new Error('ONLY_HOMEWORK_CAN_BE_UNDER_LESSON');
        }

        const destinationSiblings = await tx.lessonNode.findMany({
          where: {
            parentId: targetParentId,
            courseId,
            id: { not: movingNode.id },
          },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });

        const normalizedTargetIndex = Math.max(
          0,
          Math.min(targetIndex, destinationSiblings.length),
        );

        const orderedDestinationNodeIds = [
          ...destinationSiblings
            .slice(0, normalizedTargetIndex)
            .map((node) => node.id),
          movingNode.id,
          ...destinationSiblings
            .slice(normalizedTargetIndex)
            .map((node) => node.id),
        ];

        for (const [index, id] of orderedDestinationNodeIds.entries()) {
          if (id === movingNode.id) {
            await tx.lessonNode.update({
              where: { id },
              data: {
                parentId: targetParentId,
                order: index,
              },
            });
          } else {
            await tx.lessonNode.update({
              where: { id },
              data: { order: index },
            });
          }
        }

        if (movingNode.parentId && movingNode.parentId !== targetParentId) {
          const oldSiblings = await tx.lessonNode.findMany({
            where: {
              parentId: movingNode.parentId,
              courseId,
            },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          });

          for (const [index, sibling] of oldSiblings.entries()) {
            await tx.lessonNode.update({
              where: { id: sibling.id },
              data: { order: index },
            });
          }
        }

        return {
          movedId: movingNode.id,
          targetParentId,
          targetIndex: normalizedTargetIndex,
        };
      });

      return {
        success: true,
        data: movedResult,
      };
    } catch (error: any) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'NODE_NOT_FOUND_OR_INVALID_COURSE':
            return {
              success: false,
              error: 'Node không tồn tại hoặc không thuộc course này',
            };
          case 'TARGET_PARENT_NOT_FOUND_OR_INVALID_COURSE':
            return {
              success: false,
              error: 'Target parent không tồn tại hoặc không thuộc course này',
            };
          case 'CANNOT_MOVE_NODE_INTO_ITSELF':
            return { success: false, error: 'Không thể di chuyển node vào chính nó' };
          case 'CANNOT_MOVE_NODE_INTO_DESCENDANT':
            return {
              success: false,
              error: 'Không thể di chuyển node vào node con của nó',
            };
          case 'HOMEWORK_MUST_BE_UNDER_LESSON':
            return {
              success: false,
              error: 'Homework chỉ có thể nằm trong Lesson',
            };
          case 'ONLY_HOMEWORK_CAN_BE_UNDER_LESSON':
            return {
              success: false,
              error: 'Chỉ Homework mới có thể nằm trong Lesson',
            };
          default:
            break;
        }
      }

      console.error('Error reordering lesson node:', error);
      return { success: false, error: 'Có lỗi xảy ra khi sắp xếp node' };
    }
  }

  async getHomeworkStatus(courseId: string, classId: string, userId: string) {
    try {
      const membership = await this.prisma.classMember.findUnique({
        where: { classId_userId: { classId, userId } },
        select: { role: true },
      });

      if (!membership || membership.role !== 'student') {
        return { success: false, error: 'Not a student of this class' };
      }

      const classLessonNodes = await this.prisma.classLessonNode.findMany({
        where: { classId, type: 'homework_imp' },
        select: { id: true, lessonNodeId: true },
      });

      if (classLessonNodes.length === 0) {
        return {
          success: true,
          data: {
            assignedByLessonNode: {},
            submittedByLessonNode: {},
            correctByLessonNode: {},
            submissionsByAssignmentId: {},
          },
        };
      }

      const classLessonNodeIds = classLessonNodes.map((cln) => cln.id);

      const studentAssignments = await this.prisma.studentAssignment.findMany({
        where: {
          studentId: userId,
          assignmentId: { in: classLessonNodeIds },
        },
        select: {
          assignmentId: true,
          submissionData: true,
          submittedAt: true,
        },
      });

      const assignedSet = new Set(
        studentAssignments.map((sa) => sa.assignmentId),
      );
      const submittedSet = new Set(
        studentAssignments
          .filter((sa) => sa.submissionData !== null)
          .map((sa) => sa.assignmentId),
      );
      const correctSet = new Set(
        studentAssignments
          .filter((sa) => {
            const data = sa.submissionData as any;
            return data?.evaluation?.isCorrect === true;
          })
          .map((sa) => sa.assignmentId),
      );

      const assignedByLessonNode: Record<string, number> = {};
      const submittedByLessonNode: Record<string, number> = {};
      const correctByLessonNode: Record<string, number> = {};

      classLessonNodes.forEach((cln) => {
        const lessonNodeId = cln.lessonNodeId;
        const classLessonNodeId = cln.id;

        if (assignedSet.has(classLessonNodeId)) {
          assignedByLessonNode[lessonNodeId] =
            (assignedByLessonNode[lessonNodeId] || 0) + 1;

          if (submittedSet.has(classLessonNodeId)) {
            submittedByLessonNode[lessonNodeId] =
              (submittedByLessonNode[lessonNodeId] || 0) + 1;
          }

          if (correctSet.has(classLessonNodeId)) {
            correctByLessonNode[lessonNodeId] =
              (correctByLessonNode[lessonNodeId] || 0) + 1;
          }
        }
      });

      const submissionsByAssignmentId: Record<
        string,
        {
          hasSubmitted: boolean;
          submittedAt: string | null;
          evaluation?: {
            isCorrect: boolean;
            score: number;
            maxScore: number;
          };
        }
      > = {};

      studentAssignments.forEach((sa) => {
        const submissionData = sa.submissionData as any;
        submissionsByAssignmentId[sa.assignmentId] = {
          hasSubmitted: sa.submissionData !== null,
          submittedAt: sa.submittedAt ? sa.submittedAt.toISOString() : null,
          evaluation: submissionData?.evaluation,
        };
      });

      return {
        success: true,
        data: {
          assignedByLessonNode,
          submittedByLessonNode,
          correctByLessonNode,
          submissionsByAssignmentId,
        },
      };
    } catch (error) {
      console.error('Error getting student homework status:', error);
      return { success: false, error: 'Có lỗi xảy ra' };
    }
  }

  async getHomeworkStatusForTeacher(
    courseId: string,
    classId: string,
    studentId: string,
    requesterId: string,
  ) {
    const membership = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: requesterId } },
      select: { role: true },
    });

    if (
      !membership ||
      (membership.role !== 'teacher' && membership.role !== 'owner')
    ) {
      return {
        success: false,
        error: 'Forbidden: Not a teacher of this class',
      };
    }

    return this.getHomeworkStatus(courseId, classId, studentId);
  }

  async getAllStudentsHomeworkSummary(
    courseId: string,
    classId: string,
    requesterId: string,
  ) {
    const membership = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: requesterId } },
      select: { role: true },
    });

    if (
      !membership ||
      (membership.role !== 'teacher' && membership.role !== 'owner')
    ) {
      return { success: false, error: 'Forbidden' };
    }

    try {
      const classLessonNodes = await this.prisma.classLessonNode.findMany({
        where: { classId, type: 'homework_imp' },
        select: { id: true },
      });

      if (classLessonNodes.length === 0) {
        return { success: true, data: {} };
      }

      const clnIds = classLessonNodes.map((cln) => cln.id);

      const allAssignments = await this.prisma.studentAssignment.findMany({
        where: { assignmentId: { in: clnIds } },
        select: {
          studentId: true,
          assignmentId: true,
          submissionData: true,
        },
      });

      const statsMap: Record<
        string,
        { totalAssigned: number; correct: number }
      > = {};

      allAssignments.forEach((sa) => {
        if (!statsMap[sa.studentId]) {
          statsMap[sa.studentId] = { totalAssigned: 0, correct: 0 };
        }
        statsMap[sa.studentId].totalAssigned += 1;

        const data = sa.submissionData as any;
        if (data?.evaluation?.isCorrect === true) {
          statsMap[sa.studentId].correct += 1;
        }
      });

      return { success: true, data: statsMap };
    } catch (error) {
      console.error('Error getting all students homework summary:', error);
      return { success: false, error: 'Có lỗi xảy ra' };
    }
  }

  async canCreateCourse(orgId: string, userId: string) {
    // Check membership - simplified version without hasPermission API
    const isMember = await this.prisma.member.findFirst({
      where: {
        userId,
        organization: { id: orgId },
      },
      select: { role: true },
    });

    if (!isMember) {
      return { success: false, error: 'Not a member of this organization' };
    }

    // Allow owner/admin roles
    if (isMember.role === 'owner' || isMember.role === 'admin') {
      return { success: true };
    }

    return { success: false, error: 'No permission to create courses' };
  }
}
