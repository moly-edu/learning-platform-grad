import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDueAutoAssignmentsMock } = vi.hoisted(() => ({
  runDueAutoAssignmentsMock: vi.fn(),
}));

vi.mock("@/server/auto-assignment", () => ({
  runDueAutoAssignments: runDueAutoAssignmentsMock,
}));

import { GET, POST } from "@/app/api/internal/auto-assign/tick/route";

describe("/api/internal/auto-assign/tick", () => {
  const originalSecret = process.env.AUTO_ASSIGN_CRON_SECRET;

  beforeEach(() => {
    runDueAutoAssignmentsMock.mockReset();
    process.env.AUTO_ASSIGN_CRON_SECRET = "secret-123";
  });

  afterEach(() => {
    process.env.AUTO_ASSIGN_CRON_SECRET = originalSecret;
  });

  it("returns 401 for unauthorized GET requests", async () => {
    const response = await GET(new Request("http://localhost/api/internal/auto-assign/tick"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 for unauthorized POST requests", async () => {
    const response = await POST(new Request("http://localhost/api/internal/auto-assign/tick"));
    expect(response.status).toBe(401);
  });

  it("executes schedules when authorization header is valid", async () => {
    runDueAutoAssignmentsMock.mockResolvedValue({
      executed: 2,
      details: [{ scheduleId: "s1" }],
    });

    const response = await POST(
      new Request("http://localhost/api/internal/auto-assign/tick", {
        method: "POST",
        headers: { authorization: "Bearer secret-123" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      executed: 2,
      details: [{ scheduleId: "s1" }],
    });
  });

  it("returns 500 when the scheduler throws", async () => {
    runDueAutoAssignmentsMock.mockRejectedValue(new Error("boom"));

    const response = await POST(
      new Request("http://localhost/api/internal/auto-assign/tick", {
        method: "POST",
        headers: { authorization: "Bearer secret-123" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});
