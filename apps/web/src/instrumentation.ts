import { runDueAutoAssignments } from "./server/auto-assignment";

declare global {
  // eslint-disable-next-line no-var
  var __autoAssignDevTickerStarted: boolean | undefined;
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isDevAutoTickEnabled() {
  return process.env.AUTO_ASSIGN_DEV_AUTO_TICK !== "false";
}

function getDevTickMs() {
  return toPositiveInt(process.env.AUTO_ASSIGN_DEV_TICK_MS, 60_000);
}

async function executeTick() {
  try {
    const summary = await runDueAutoAssignments(new Date());
    if (summary.executed > 0) {
      console.log(
        `[AUTO_ASSIGN_DEV_TICK] executed=${summary.executed} schedules`,
      );
    }
  } catch (error) {
    console.error("[AUTO_ASSIGN_DEV_TICK_ERROR]", error);
  }
}

export async function register() {
  if (process.env.NODE_ENV !== "development") return;
  if (!isDevAutoTickEnabled()) return;
  if (global.__autoAssignDevTickerStarted) return;

  global.__autoAssignDevTickerStarted = true;

  const intervalMs = getDevTickMs();

  // Run once on startup, then continue polling.
  void executeTick();

  const interval = setInterval(() => {
    void executeTick();
  }, intervalMs);

  // Prevent the timer from keeping the process alive on shutdown.
  interval.unref?.();

  console.log(`[AUTO_ASSIGN_DEV_TICK] started intervalMs=${intervalMs}`);
}
