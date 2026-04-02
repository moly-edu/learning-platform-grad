import { auth } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { runScheduleNow } from "@/server/auto-assignment";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function getSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return session.user.id;
}

export async function POST(
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

    const membership = await prisma.classMember.findUnique({
      where: {
        classId_userId: {
          classId: schedule.classId,
          userId,
        },
      },
      select: { role: true },
    });

    if (
      !membership ||
      (membership.role !== "teacher" && membership.role !== "owner")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const summary = await runScheduleNow(scheduleId, new Date());

    if (!summary) {
      return NextResponse.json(
        { error: "Schedule is inactive or not found" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("[AUTO_ASSIGN_RUN_NOW_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
