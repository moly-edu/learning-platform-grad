import { runDueAutoAssignments } from "@/server/auto-assignment";
import { NextResponse } from "next/server";

function isAuthorized(request: Request) {
  const header = request.headers.get("authorization");
  const secret =
    process.env.AUTO_ASSIGN_CRON_SECRET ||
    process.env.CRON_SECRET ||
    process.env.WEBHOOK_SECRET;

  if (!secret) return false;
  return header === `Bearer ${secret}`;
}

async function handleTick(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await runDueAutoAssignments(new Date());

    return NextResponse.json({
      success: true,
      executed: summary.executed,
      details: summary.details,
    });
  } catch (error) {
    console.error("[AUTO_ASSIGN_TICK_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleTick(request);
}

export async function GET(request: Request) {
  return handleTick(request);
}
