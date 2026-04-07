"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { checkUserInOrg } from "./members";
import { revalidatePath } from "next/cache";
import {
  AddNodeInput,
  DeleteNodeInput,
  HomeworkContent,
  LessonContent,
  LessonNodeContent,
} from "@/types/course";
import { LessonNodeType } from "@repo/db";

export async function canCreateCourse(orgId: string) {
  return await auth.api.hasPermission({
    headers: await headers(),
    body: {
      organizationId: orgId,
      permissions: {
        course: ["create"],
      },
    },
  });
}

export async function createCourse(
  name: string,
  slug: string,
  organizationId: string,
  description?: string,
) {
  const isMember = await checkUserInOrg({ orgId: organizationId });
  const permission = await canCreateCourse(organizationId);

  if (!permission.success || !isMember) throw new Error("Forbidden");

  // Sử dụng Transaction để đảm bảo cả 2 bước đều thành công hoặc cùng thất bại
  return prisma.$transaction(async (tx) => {
    // 1. Tạo Course trước (chưa có rootLessonNodeId)
    const newCourse = await tx.course.create({
      data: {
        organizationId: organizationId,
        name: name,
        slug: slug,
        description: description,
        createdBy: isMember.userId,
      },
    });

    // 2. Tạo LessonNode gốc cho Course đó
    const rootNode = await tx.lessonNode.create({
      data: {
        type: LessonNodeType.course,
        title: name,
        content: {},
        courseId: newCourse.id, // Đã có ID từ bước 1
      },
    });

    // 3. Cập nhật lại Course để trỏ vào rootNode vừa tạo
    return await tx.course.update({
      where: { id: newCourse.id },
      data: {
        rootLessonNodeId: rootNode.id,
      },
      include: {
        rootLessonNode: true,
      },
    });
  });
}

export async function addLessonNode(input: AddNodeInput) {
  try {
    const { courseId, parentId, type, title, content } = input;

    const parentNode = await prisma.lessonNode.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        type: true,
        _count: {
          select: { children: true },
        },
      },
    });

    if (!parentNode) {
      return {
        success: false,
        error: "Parent node không tồn tại",
      };
    }

    // Validation logic
    if (type === LessonNodeType.homework) {
      // HOMEWORK chỉ thêm vào LESSON
      if (parentNode.type !== LessonNodeType.lesson) {
        return {
          success: false,
          error: "Chỉ có thể thêm Homework vào Lesson",
        };
      }
    } else {
      // MODULE/LESSON không thêm vào LESSON
      if (parentNode.type === LessonNodeType.lesson) {
        return {
          success: false,
          error: "Không thể thêm node vào Lesson",
        };
      }
    }

    const order = parentNode._count.children;
    const finalContent = content ?? getDefaultContent(type);

    const newNode = await prisma.lessonNode.create({
      data: {
        title,
        type,
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
        _count: {
          select: { children: true },
        },
      },
    });

    revalidatePath(`/courses/${courseId}`);

    return {
      success: true,
      data: newNode,
    };
  } catch (error) {
    console.error("Error adding lesson node:", error);
    return {
      success: false,
      error: "Có lỗi xảy ra khi thêm node",
    };
  }
}

function getDefaultContent(type: LessonNodeType): LessonNodeContent {
  switch (type) {
    case LessonNodeType.homework:
      return { widgetId: "", widgetVersion: "" } as HomeworkContent;
    default:
      return {};
  }
}

export async function updateLessonNode(input: {
  nodeId: string;
  courseId: string;
  title?: string;
  content?: any;
}) {
  try {
    const { nodeId, courseId, title, content } = input;

    // Verify node exists and belongs to course
    const node = await prisma.lessonNode.findUnique({
      where: { id: nodeId },
      select: { courseId: true, type: true },
    });

    if (!node || node.courseId !== courseId) {
      return {
        success: false,
        error: "Node không tồn tại hoặc không thuộc course này",
      };
    }

    // Prevent updating root course node title
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { rootLessonNodeId: true },
    });

    if (course?.rootLessonNodeId === nodeId && title !== undefined) {
      return { success: false, error: "Không thể đổi tên root course node" };
    }

    // Update node
    const updated = await prisma.lessonNode.update({
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
        _count: {
          select: { children: true },
        },
      },
    });

    revalidatePath(`/courses/${courseId}`);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error("Error updating lesson node:", error);
    return {
      success: false,
      error: "Có lỗi xảy ra khi cập nhật node",
    };
  }
}

export async function deleteLessonNode(input: DeleteNodeInput) {
  try {
    const { nodeId, courseId } = input;

    // Kiểm tra xem node có phải là root node không
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { rootLessonNodeId: true },
    });

    if (!course) {
      return {
        success: false,
        error: "Course không tồn tại",
      };
    }

    if (course.rootLessonNodeId === nodeId) {
      return {
        success: false,
        error: "Không thể xóa root node của course",
      };
    }

    // Check node tồn tại
    const nodeToDelete = await prisma.lessonNode.findUnique({
      where: { id: nodeId },
    });

    if (!nodeToDelete) {
      return {
        success: false,
        error: "Node không tồn tại",
      };
    }

    // Xóa node (Prisma sẽ cascade delete children nếu có onDelete: Cascade)
    const deleted = await prisma.lessonNode.delete({
      where: { id: nodeId },
    });

    revalidatePath(`/courses/${courseId}`);

    return {
      success: true,
      data: {
        deletedId: deleted.id,
      },
    };
  } catch (error) {
    console.error("Error deleting lesson node:", error);
    return {
      success: false,
      error: "Có lỗi xảy ra khi xóa node",
    };
  }
}

export async function getCourseWithFullTreeBySlug(
  orgSlug: string,
  courseSlug: string,
) {
  try {
    const isMember = await checkUserInOrg({ orgSlug: orgSlug });
    if (!isMember) throw new Error("Forbidden");

    // 1. Load course info
    const course = await prisma.course.findUnique({
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
      return {
        success: false,
        error: "Course không tồn tại",
      };
    }

    // 2. Load TẤT CẢ nodes của course
    const allNodes = await prisma.lessonNode.findMany({
      where: { courseId: course.id },
      orderBy: { order: "asc" },
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
        _count: {
          select: { children: true },
        },
      },
    });

    return {
      success: true,
      data: {
        course,
        nodes: allNodes,
      },
      role: isMember.role, // Trả về role để layout dùng
    };
  } catch (error) {
    console.error("Error loading course with full tree by slug:", error);
    return {
      success: false,
      error: "Có lỗi xảy ra khi lấy dữ liệu course",
    };
  }
}

export async function getCourses(organizationId: string) {
  await checkUserInOrg({ orgId: organizationId });

  return prisma.course.findMany({
    where: {
      organizationId: organizationId,
    },
  });
}

/**
 * Load homework counts cho student trong một class
 * Trả về Map: LessonNode.id (homework) → { totalAssigned, pending }
 */
// Internal version (used by API routes)
export async function _getStudentHomeworkStatusByClassInternal(
  userId: string,
  courseId: string,
  classId: string,
) {
  try {
    // Verify student in class
    const membership = await prisma.classMember.findUnique({
      where: {
        classId_userId: {
          classId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "student") {
      return {
        success: false,
        error: "Not a student of this class",
      };
    }

    // 1️⃣ Lấy tất cả ClassLessonNode (homework_imp) của class này
    const classLessonNodes = await prisma.classLessonNode.findMany({
      where: {
        classId: classId,
        type: "homework_imp",
      },
      select: {
        id: true,
        lessonNodeId: true,
      },
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

    // 2️⃣ Lấy StudentAssignments
    const classLessonNodeIds = classLessonNodes.map((cln) => cln.id);

    const studentAssignments = await prisma.studentAssignment.findMany({
      where: {
        studentId: userId,
        assignmentId: {
          in: classLessonNodeIds,
        },
      },
      select: {
        assignmentId: true,
        submissionData: true,
        submittedAt: true,
        attemptCount: true,
        correctAttemptCount: true,
      },
    });

    // 3️⃣ Build Maps
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

    // 4️⃣ Group by LessonNode.id
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

    // 5️⃣ Build submission status map
    const submissionsByAssignmentId: Record<
      string,
      {
        hasSubmitted: boolean;
        submittedAt: string | null;
        attemptCount: number;
        correctAttemptCount: number;
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
        attemptCount: sa.attemptCount,
        correctAttemptCount: sa.correctAttemptCount,
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
    console.error("Error getting student homework status:", error);
    return {
      success: false,
      error: "Có lỗi xảy ra",
    };
  }
}

export async function getStudentHomeworkStatusByClass(
  courseId: string,
  classId: string,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error("Unauthorized");

  return _getStudentHomeworkStatusByClassInternal(
    session.user.id,
    courseId,
    classId,
  );
}

/**
 * Teacher/Owner views a specific student's homework status
 */
export async function getStudentHomeworkStatusByClassForTeacher(
  courseId: string,
  classId: string,
  studentId: string,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  // Verify caller is teacher/owner of the class
  const membership = await prisma.classMember.findUnique({
    where: {
      classId_userId: { classId, userId: session.user.id },
    },
    select: { role: true },
  });

  if (
    !membership ||
    (membership.role !== "teacher" && membership.role !== "owner")
  ) {
    return {
      success: false,
      error: "Forbidden: Not a teacher of this class",
    };
  }

  return _getStudentHomeworkStatusByClassInternal(studentId, courseId, classId);
}

/**
 * Get homework summary stats for ALL students in a class (teacher/owner only)
 * Returns: { studentId → { totalAssigned, correct } }
 */
export async function getAllStudentsHomeworkSummary(
  courseId: string,
  classId: string,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  // Verify caller is teacher/owner
  const membership = await prisma.classMember.findUnique({
    where: {
      classId_userId: { classId, userId: session.user.id },
    },
    select: { role: true },
  });

  if (
    !membership ||
    (membership.role !== "teacher" && membership.role !== "owner")
  ) {
    return { success: false, error: "Forbidden" };
  }

  try {
    // 1. Get all homework_imp ClassLessonNodes in this class
    const classLessonNodes = await prisma.classLessonNode.findMany({
      where: {
        classId,
        type: "homework_imp",
      },
      select: { id: true },
    });

    if (classLessonNodes.length === 0) {
      return { success: true, data: {} };
    }

    const clnIds = classLessonNodes.map((cln) => cln.id);

    // 2. Get ALL StudentAssignments for these CLNs (all students)
    const allAssignments = await prisma.studentAssignment.findMany({
      where: {
        assignmentId: { in: clnIds },
      },
      select: {
        studentId: true,
        assignmentId: true,
        submissionData: true,
      },
    });

    // 3. Aggregate per student
    const statsMap: Record<string, { totalAssigned: number; correct: number }> =
      {};

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
    console.error("Error getting all students homework summary:", error);
    return { success: false, error: "Có lỗi xảy ra" };
  }
}
