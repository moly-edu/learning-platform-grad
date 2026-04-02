// app/api/student/assignment/[assignmentId]/submit/route.ts

import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  getActiveScheduleForHomework,
  getScheduleById,
} from "@/server/auto-assignment";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function isCorrectSubmission(submissionData: unknown) {
  if (!submissionData || typeof submissionData !== "object") return false;
  const evaluation = (
    submissionData as { evaluation?: { isCorrect?: boolean } }
  ).evaluation;
  return evaluation?.isCorrect === true;
}

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

    const { answer, evaluation } = body;

    if (!answer || !evaluation) {
      return NextResponse.json(
        { error: "Missing answer or evaluation" },
        { status: 400 },
      );
    }

    // Validate evaluation structure
    if (
      typeof evaluation.isCorrect !== "boolean" ||
      typeof evaluation.score !== "number" ||
      typeof evaluation.maxScore !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid evaluation format" },
        { status: 400 },
      );
    }

    // Kiểm tra assignment tồn tại
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

    const existingAssignment = await prisma.studentAssignment.findUnique({
      where: {
        studentId_assignmentId: {
          studentId: session.user.id,
          assignmentId,
        },
      },
      select: {
        id: true,
        source: true,
        scheduleId: true,
        rootAssignmentId: true,
      },
    });

    const activeSchedule = existingAssignment?.scheduleId
      ? await getScheduleById(existingAssignment.scheduleId)
      : await getActiveScheduleForHomework(
          assignment.classId,
          assignment.lessonNodeId,
        );

    const scheduleId =
      activeSchedule?.id ?? existingAssignment?.scheduleId ?? null;
    const rootAssignmentId =
      existingAssignment?.rootAssignmentId ?? assignmentId;

    let reviewDueAt: Date | null = null;

    if (!evaluation.isCorrect && activeSchedule && scheduleId) {
      const incorrectAttempts = await prisma.studentAssignment.findMany({
        where: {
          studentId: session.user.id,
          scheduleId,
          rootAssignmentId,
          assignmentId: {
            not: assignmentId,
          },
        },
        select: {
          submissionData: true,
        },
      });

      const previousIncorrectCount = incorrectAttempts.filter((attempt) => {
        if (attempt.submissionData === null) return false;
        return !isCorrectSubmission(attempt.submissionData);
      }).length;

      const incorrectCount = previousIncorrectCount + 1;

      if (incorrectCount < activeSchedule.maxRetryPerRoot) {
        const delayMinutes = Math.min(
          14 * 24 * 60,
          Math.max(1, activeSchedule.initialReviewDelayMinutes) *
            2 ** Math.max(0, incorrectCount - 1),
        );
        reviewDueAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      }
    }

    // Lưu submission (upsert để tránh duplicate)
    const submission = await prisma.studentAssignment.upsert({
      where: {
        studentId_assignmentId: {
          studentId: session.user.id,
          assignmentId: assignmentId,
        },
      },
      create: {
        studentId: session.user.id,
        assignmentId,
        submissionData: {
          answer,
          evaluation,
        },
        submittedAt: new Date(),
        source: existingAssignment?.source ?? "teacher",
        scheduleId,
        rootAssignmentId,
        reviewDueAt,
      },
      update: {
        submissionData: {
          answer,
          evaluation,
        },
        submittedAt: new Date(),
        scheduleId,
        rootAssignmentId,
        reviewDueAt,
      },
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error("[SUBMIT_ASSIGNMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
