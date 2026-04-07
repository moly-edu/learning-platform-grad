// app/api/class/assignment/[assignmentId]/teacher-student-view/route.ts
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
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) throw new Error("Unauthorized");

    // 1️⃣ Load assignment (ClassLessonNode)
    const assignment = await prisma.classLessonNode.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classId: true,
        lessonNodeId: true,
        content: true,
        type: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 },
      );
    }

    // 2️⃣ Verify caller is teacher/owner
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
      return NextResponse.json(
        { error: "Forbidden: Not a teacher of this class" },
        { status: 403 },
      );
    }

    if (!assignment.content) {
      return NextResponse.json(
        { error: "Assignment chưa có cấu hình" },
        { status: 400 },
      );
    }

    // 3️⃣ Get widget info
    const { widgetId, buildRunId } = await getBuildRunIdFromLessonNode(
      assignment.lessonNodeId,
    );

    if (!widgetId || !buildRunId) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    // 4️⃣ Get student's submission (if exists)
    const studentSubmission = await prisma.studentAssignment.findUnique({
      where: {
        studentId_assignmentId: {
          studentId: studentId,
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

    return NextResponse.json({
      assignmentId: assignment.id,
      classId: assignment.classId,
      lessonNodeId: assignment.lessonNodeId,
      assignmentConfig: stripGeneratorMeta(
        assignment.content as Record<string, any>,
      ),
      widgetId,
      buildRunId,
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
    console.error("[TEACHER_STUDENT_VIEW_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
