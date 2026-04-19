import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { stripGeneratorMeta } from "@/lib/widget-assignment-generator";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const classId = request.nextUrl.searchParams.get("classId");
    const homeworkNodeId = request.nextUrl.searchParams.get("homeworkNodeId");

    if (!classId || !homeworkNodeId) {
      return NextResponse.json(
        { success: false, error: "classId and homeworkNodeId are required" },
        { status: 400 },
      );
    }

    // Check membership
    const membership = await prisma.classMember.findUnique({
      where: {
        classId_userId: {
          classId,
          userId: session.user.id,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Get all ClassLessonNodes (assignments) for this homework (newest first)
    const allAssignments = await prisma.classLessonNode.findMany({
      where: {
        lessonNodeId: homeworkNodeId,
        classId,
        type: "homework_imp",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get student's assigned assignments (only those in StudentAssignment table)
    const studentAssignments = await prisma.studentAssignment.findMany({
      where: {
        studentId: session.user.id,
        assignmentId: { in: allAssignments.map((a) => a.id) },
      },
      select: {
        assignmentId: true,
        submissionData: true,
        submittedAt: true,
        latestSubmittedAt: true,
        attemptCount: true,
        correctAttemptCount: true,
        attempts: {
          select: {
            submissionData: true,
          },
        },
      },
    });

    // Build map of assigned assignments with submission data
    const assignedMap = new Map<string, (typeof studentAssignments)[number]>(
      studentAssignments.map((s) => [s.assignmentId, s]),
    );

    // Filter: Only keep assignments that were assigned to this student
    const assignedAssignments = allAssignments.filter((a) =>
      assignedMap.has(a.id),
    );

    // Format assignments with submission status
    const formattedAssignments = assignedAssignments.map((assignment) => {
      const submission = assignedMap.get(assignment.id);
      const submissionData = submission?.submissionData as any;
      const assignmentContent =
        (assignment.content as Record<string, any>) || {};
      const attemptScores = (submission?.attempts ?? [])
        .map((attempt) => {
          const data = attempt.submissionData as any;
          const score = data?.evaluation?.score;
          return typeof score === "number" ? score : null;
        })
        .filter((score): score is number => score !== null);
      const firstScore =
        typeof submissionData?.evaluation?.score === "number"
          ? submissionData.evaluation.score
          : null;
      const highestScore =
        attemptScores.length > 0
          ? Math.max(...attemptScores)
          : (firstScore ?? 0);

      return {
        id: assignment.id,
        title: assignmentContent.title || "Assignment",
        description: assignmentContent.description || "",
        hasSubmitted: submission ? submission.submissionData !== null : false,
        submittedAt: submission?.submittedAt
          ? submission.submittedAt.toISOString()
          : null,
        latestSubmittedAt:
          submission && submission.latestSubmittedAt
            ? new Date(submission.latestSubmittedAt as any).toISOString()
            : null,
        attemptCount: submission?.attemptCount || 0,
        correctAttemptCount: submission?.correctAttemptCount || 0,
        highestScore,
        evaluation: submissionData?.evaluation || null,
        content: stripGeneratorMeta(assignment.content as Record<string, any>),
      };
    });

    // Sort: incomplete assignments first, then by original order
    formattedAssignments.sort((a, b) => {
      if (a.hasSubmitted === b.hasSubmitted) return 0;
      return a.hasSubmitted ? 1 : -1;
    });

    return NextResponse.json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error("Error getting assignments:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch assignments",
      },
      { status: 500 },
    );
  }
}
