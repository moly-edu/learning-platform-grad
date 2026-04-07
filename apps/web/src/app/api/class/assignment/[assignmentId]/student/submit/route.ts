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

type SubmissionEvaluation = {
  isCorrect: boolean;
  score: number;
  maxScore: number;
};

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

    const { answer, evaluation } = body as {
      answer: unknown;
      evaluation: SubmissionEvaluation;
    };

    if (typeof answer === "undefined" || typeof evaluation === "undefined") {
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
        reviewDueAt: true,
        submissionData: true,
        submittedAt: true,
        attemptCount: true,
        correctAttemptCount: true,
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
    const now = new Date();

    const submissionData = {
      answer,
      evaluation,
    };

    const hasFirstSubmission = Boolean(existingAssignment?.submissionData);
    const isFirstAttempt = !hasFirstSubmission;
    const correctAttemptIncrement = evaluation.isCorrect ? 1 : 0;

    let reviewDueAt: Date | null = existingAssignment?.reviewDueAt ?? null;

    if (isFirstAttempt) {
      reviewDueAt = null;

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
          reviewDueAt = new Date(now.getTime() + delayMinutes * 60 * 1000);
        }
      }
    }

    // First attempt fields are immutable. Later attempts only update latest snapshot + counters.
    const submission = await prisma.$transaction(async (tx) => {
      let savedAssignment:
        | {
            id: string;
            submittedAt: Date | null;
            latestSubmittedAt: Date | null;
            attemptCount: number;
            correctAttemptCount: number;
            submissionData: unknown;
          }
        | null = null;

      if (!existingAssignment) {
        savedAssignment = await tx.studentAssignment.create({
          data: {
            studentId: session.user.id,
            assignmentId,
            submissionData,
            submittedAt: now,
            latestSubmissionData: submissionData,
            latestSubmittedAt: now,
            attemptCount: 1,
            correctAttemptCount: correctAttemptIncrement,
            source: scheduleId ? "system" : "teacher",
            scheduleId,
            rootAssignmentId,
            reviewDueAt,
          },
          select: {
            id: true,
            submittedAt: true,
            latestSubmittedAt: true,
            attemptCount: true,
            correctAttemptCount: true,
            submissionData: true,
          },
        });
      } else if (isFirstAttempt) {
        savedAssignment = await tx.studentAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            submissionData,
            submittedAt: now,
            latestSubmissionData: submissionData,
            latestSubmittedAt: now,
            attemptCount: 1,
            correctAttemptCount: correctAttemptIncrement,
            scheduleId,
            rootAssignmentId,
            reviewDueAt,
          },
          select: {
            id: true,
            submittedAt: true,
            latestSubmittedAt: true,
            attemptCount: true,
            correctAttemptCount: true,
            submissionData: true,
          },
        });
      } else {
        savedAssignment = await tx.studentAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            latestSubmissionData: submissionData,
            latestSubmittedAt: now,
            attemptCount: { increment: 1 },
            ...(evaluation.isCorrect
              ? { correctAttemptCount: { increment: 1 } }
              : {}),
            ...(existingAssignment.scheduleId ? {} : { scheduleId }),
            ...(existingAssignment.rootAssignmentId
              ? {}
              : { rootAssignmentId }),
          },
          select: {
            id: true,
            submittedAt: true,
            latestSubmittedAt: true,
            attemptCount: true,
            correctAttemptCount: true,
            submissionData: true,
          },
        });
      }

      await tx.studentAssignmentAttempt.create({
        data: {
          studentAssignmentId: savedAssignment.id,
          attemptNumber: savedAssignment.attemptCount,
          submissionData,
          isCorrect: evaluation.isCorrect,
          submittedAt: now,
        },
      });

      return savedAssignment;
    });

    const firstEvaluation =
      ((submission.submissionData as { evaluation?: SubmissionEvaluation } | null)
        ?.evaluation as SubmissionEvaluation | undefined) ?? null;

    return NextResponse.json({
      success: true,
      isFirstAttempt,
      submission: {
        id: submission.id,
        submittedAt: submission.submittedAt,
        latestSubmittedAt: submission.latestSubmittedAt,
        attemptCount: submission.attemptCount,
        correctAttemptCount: submission.correctAttemptCount,
        firstEvaluation,
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
