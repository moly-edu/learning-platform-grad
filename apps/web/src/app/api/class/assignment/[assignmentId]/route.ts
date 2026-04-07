// app/api/class/assignment/[assignmentId]/route.ts

import prisma from "@/lib/prisma";
import { getBuildRunIdFromLessonNode } from "@/server/class-lesson-node";
import { stripGeneratorMeta } from "@/lib/widget-assignment-generator";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;

  if (!assignmentId) {
    return NextResponse.json(
      { error: "assignmentId is required" },
      { status: 400 },
    );
  }

  try {
    // 1️⃣ Lấy ClassLessonNode (assignment instance)
    const classLessonNode = await prisma.classLessonNode.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classId: true,
        lessonNodeId: true,
        content: true, // Saved config
        type: true,
        createdAt: true,
      },
    });

    if (!classLessonNode) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 },
      );
    }

    // 2️⃣ Lấy widgetId và buildRunId từ LessonNode (homework template)
    const { widgetId, buildRunId } = await getBuildRunIdFromLessonNode(
      classLessonNode.lessonNodeId,
    );

    if (!widgetId || !buildRunId) {
      return NextResponse.json(
        { error: "Widget not found for this assignment" },
        { status: 404 },
      );
    }

    // 3️⃣ Trả về đầy đủ thông tin
    return NextResponse.json({
      // Assignment info
      assignmentId: classLessonNode.id,
      classId: classLessonNode.classId,
      lessonNodeId: classLessonNode.lessonNodeId,
      savedConfig: stripGeneratorMeta(
        classLessonNode.content as Record<string, any>,
      ),

      // Widget info (để lấy HTML)
      widgetId,
      buildRunId,
    });
  } catch (error) {
    console.error("[GET_ASSIGNMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
