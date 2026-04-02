import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type IntervalUnitBody = "minute" | "hour" | "day";

async function getSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return session.user.id;
}

async function assertTeacherOrOwner(classId: string, userId: string) {
  const membership = await prisma.classMember.findUnique({
    where: {
      classId_userId: {
        classId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  return (
    membership && (membership.role === "teacher" || membership.role === "owner")
  );
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required" },
        { status: 400 },
      );
    }

    const canView = await prisma.classMember.findUnique({
      where: {
        classId_userId: {
          classId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schedules = await prisma.autoAssignmentSchedule.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        classId: true,
        homeworkNodeId: true,
        startAt: true,
        intervalValue: true,
        intervalUnit: true,
        decayFactor: true,
        minAutoNew: true,
        initialReviewDelayMinutes: true,
        maxRetryPerRoot: true,
        isActive: true,
        lastAutoRunAt: true,
        runCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error("[AUTO_ASSIGN_SCHEDULE_LIST_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    const classId = String(body.classId ?? "");
    const homeworkNodeId = String(body.homeworkNodeId ?? "");
    const startAtRaw = body.startAt;

    const intervalValue = Number(body.intervalValue ?? 2);
    const intervalUnit = (body.intervalUnit ?? "day") as IntervalUnitBody;
    const decayFactor = Number(body.decayFactor ?? 0.5);
    const minAutoNew = Number(body.minAutoNew ?? 1);
    const initialReviewDelayMinutes = Number(
      body.initialReviewDelayMinutes ?? 30,
    );
    const maxRetryPerRoot = Number(body.maxRetryPerRoot ?? 6);
    const isActive = body.isActive !== false;

    if (!classId || !homeworkNodeId || !startAtRaw) {
      return NextResponse.json(
        { error: "classId, homeworkNodeId, startAt are required" },
        { status: 400 },
      );
    }

    if (!["minute", "hour", "day"].includes(intervalUnit)) {
      return NextResponse.json(
        { error: "Invalid intervalUnit" },
        { status: 400 },
      );
    }

    const startAt = new Date(startAtRaw);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
    }

    const allowed = await assertTeacherOrOwner(classId, userId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const homeworkNode = await prisma.lessonNode.findUnique({
      where: { id: homeworkNodeId },
      select: {
        id: true,
        type: true,
        courseId: true,
      },
    });

    if (!homeworkNode || homeworkNode.type !== "homework") {
      return NextResponse.json(
        { error: "homeworkNodeId must be a homework node" },
        { status: 400 },
      );
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        courseId: true,
      },
    });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    if (classData.courseId !== homeworkNode.courseId) {
      return NextResponse.json(
        { error: "homeworkNode does not belong to class course" },
        { status: 400 },
      );
    }

    const saved = await prisma.autoAssignmentSchedule.upsert({
      where: {
        classId_homeworkNodeId: {
          classId,
          homeworkNodeId,
        },
      },
      update: {
        startAt,
        intervalValue: Math.max(1, intervalValue),
        intervalUnit,
        decayFactor: Math.max(0, decayFactor),
        minAutoNew: Math.max(0, minAutoNew),
        initialReviewDelayMinutes: Math.max(1, initialReviewDelayMinutes),
        maxRetryPerRoot: Math.max(1, maxRetryPerRoot),
        isActive,
      },
      create: {
        classId,
        homeworkNodeId,
        createdBy: userId,
        startAt,
        intervalValue: Math.max(1, intervalValue),
        intervalUnit,
        decayFactor: Math.max(0, decayFactor),
        minAutoNew: Math.max(0, minAutoNew),
        initialReviewDelayMinutes: Math.max(1, initialReviewDelayMinutes),
        maxRetryPerRoot: Math.max(1, maxRetryPerRoot),
        isActive,
      },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("[AUTO_ASSIGN_SCHEDULE_SAVE_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
