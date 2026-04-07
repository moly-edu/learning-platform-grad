// app/api/student/assignment/[assignmentId]/route.ts

import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBuildRunIdFromLessonNode } from "@/server/class-lesson-node";
import { stripGeneratorMeta } from "@/lib/widget-assignment-generator";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { assignmentId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) throw new Error("Unauthorized");

    // 1️⃣ Lấy thông tin assignment (ClassLessonNode)
    const assignment = await prisma.classLessonNode.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classId: true,
        lessonNodeId: true,
        content: true, // Config từ teacher
        type: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 },
      );
    }

    if (!assignment.content) {
      return NextResponse.json(
        { error: "Assignment không có cấu hình từ giáo viên" },
        { status: 400 },
      );
    }

    // 2️⃣ Lấy widgetId và buildRunId từ LessonNode
    const { widgetId, buildRunId } = await getBuildRunIdFromLessonNode(
      assignment.lessonNodeId,
    );

    if (!widgetId || !buildRunId) {
      return NextResponse.json(
        { error: "Widget not found for this assignment" },
        { status: 404 },
      );
    }

    // 3️⃣ Kiểm tra xem student đã làm chưa
    const studentSubmission = await prisma.studentAssignment.findUnique({
      where: {
        studentId_assignmentId: {
          studentId: session.user.id,
          assignmentId: assignmentId,
        },
      },
      select: {
        id: true,
        submissionData: true,
        submittedAt: true,
        latestSubmissionData: true,
        latestSubmittedAt: true,
        attemptCount: true,
        correctAttemptCount: true,
        attempts: {
          orderBy: {
            attemptNumber: "asc",
          },
          select: {
            id: true,
            attemptNumber: true,
            submissionData: true,
            isCorrect: true,
            submittedAt: true,
          },
        },
      },
    });

    const attempts =
      studentSubmission?.attempts.map((attempt) => {
        const parsedSubmission = attempt.submissionData as
          | Record<string, any>
          | null;

        return {
          id: attempt.id,
          attemptNumber: attempt.attemptNumber,
          submissionData: attempt.submissionData,
          answer: parsedSubmission?.answer ?? null,
          evaluation: parsedSubmission?.evaluation ?? null,
          isCorrect: attempt.isCorrect,
          submittedAt: attempt.submittedAt,
        };
      }) ?? [];

    // 4️⃣ Trả về đầy đủ thông tin
    return NextResponse.json({
      // Assignment info
      assignmentId: assignment.id,
      classId: assignment.classId,
      lessonNodeId: assignment.lessonNodeId,
      assignmentConfig: stripGeneratorMeta(
        assignment.content as Record<string, any>,
      ),

      // Widget info
      widgetId,
      buildRunId,

      // Student submission status
      hasSubmitted: !!studentSubmission?.submissionData,
      submissionData: studentSubmission?.submissionData || null,
      submittedAt: studentSubmission?.submittedAt || null,
      latestSubmissionData: studentSubmission?.latestSubmissionData || null,
      latestSubmittedAt: studentSubmission?.latestSubmittedAt || null,
      attemptCount: studentSubmission?.attemptCount || 0,
      correctAttemptCount: studentSubmission?.correctAttemptCount || 0,
      attempts,
    });
  } catch (error) {
    console.error("[GET_STUDENT_ASSIGNMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
