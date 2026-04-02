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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  try {
    const userId = await getSessionUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { scheduleId } = await params;
    const body = await request.json();

    const schedule = await prisma.autoAssignmentSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        classId: true,
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    const allowed = await assertTeacherOrOwner(schedule.classId, userId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};

    if (body.startAt !== undefined) {
      const startAt = new Date(body.startAt);
      if (Number.isNaN(startAt.getTime())) {
        return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
      }
      data.startAt = startAt;
    }

    if (body.intervalValue !== undefined) {
      data.intervalValue = Math.max(1, Number(body.intervalValue));
    }

    if (body.intervalUnit !== undefined) {
      const intervalUnit = body.intervalUnit as IntervalUnitBody;
      if (!["minute", "hour", "day"].includes(intervalUnit)) {
        return NextResponse.json(
          { error: "Invalid intervalUnit" },
          { status: 400 },
        );
      }
      data.intervalUnit = intervalUnit;
    }

    if (body.decayFactor !== undefined) {
      data.decayFactor = Math.max(0, Number(body.decayFactor));
    }

    if (body.minAutoNew !== undefined) {
      data.minAutoNew = Math.max(0, Number(body.minAutoNew));
    }

    if (body.initialReviewDelayMinutes !== undefined) {
      data.initialReviewDelayMinutes = Math.max(
        1,
        Number(body.initialReviewDelayMinutes),
      );
    }

    if (body.maxRetryPerRoot !== undefined) {
      data.maxRetryPerRoot = Math.max(1, Number(body.maxRetryPerRoot));
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.autoAssignmentSchedule.update({
      where: { id: scheduleId },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[AUTO_ASSIGN_SCHEDULE_PATCH_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  try {
    const userId = await getSessionUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { scheduleId } = await params;

    const schedule = await prisma.autoAssignmentSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        classId: true,
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    const allowed = await assertTeacherOrOwner(schedule.classId, userId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.autoAssignmentSchedule.delete({
      where: { id: scheduleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTO_ASSIGN_SCHEDULE_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
