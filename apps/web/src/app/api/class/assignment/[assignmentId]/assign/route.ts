// app/api/class/assignment/[assignmentId]/assign/route.ts

import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  assignStudentsToAssignment,
  getOrCreateActiveScheduleForHomework,
} from "@/server/auto-assignment";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { assignmentId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) throw new Error("Unauthorized");
    const body = await request.json();
    const { studentId, studentIds } = body;

    // Support both single studentId and bulk studentIds
    const idsToAssign: string[] = studentIds
      ? studentIds
      : studentId
        ? [studentId]
        : [];

    if (idsToAssign.length === 0) {
      return NextResponse.json(
        { error: "Missing studentId or studentIds" },
        { status: 400 },
      );
    }

    // 1️⃣ Lấy thông tin assignment
    const assignment = await prisma.classLessonNode.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classId: true,
        lessonNodeId: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 },
      );
    }

    // 2️⃣ Kiểm tra quyền teacher
    const membership = await prisma.classMember.findUnique({
      where: {
        classId_userId: {
          classId: assignment.classId,
          userId: session.user.id,
        },
      },
    });

    if (
      !membership ||
      (membership.role !== "teacher" && membership.role !== "owner")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3️⃣ Kiểm tra tất cả students có trong class không
    const studentMemberships = await prisma.classMember.findMany({
      where: {
        classId: assignment.classId,
        userId: { in: idsToAssign },
        role: "student",
      },
      select: { userId: true },
    });

    const validStudentIds = studentMemberships.map((m) => m.userId);

    if (validStudentIds.length === 0) {
      return NextResponse.json(
        { error: "No valid students found in this class" },
        { status: 404 },
      );
    }

    const activeSchedule = await getOrCreateActiveScheduleForHomework(
      assignment.classId,
      assignment.lessonNodeId,
      session.user.id,
    );

    const reviewDueAt = activeSchedule
      ? new Date(
          Date.now() + activeSchedule.initialReviewDelayMinutes * 60 * 1000,
        )
      : null;

    const assignResult = await assignStudentsToAssignment({
      assignmentId,
      studentIds: validStudentIds,
      source: "teacher",
      scheduleId: activeSchedule?.id,
      rootAssignmentId: assignmentId,
      reviewDueAt,
    });

    return NextResponse.json({
      success: true,
      assigned: assignResult.assigned,
      skipped: assignResult.skipped,
      total: assignResult.total,
    });
  } catch (error) {
    console.error("[ASSIGN_TO_STUDENT_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
