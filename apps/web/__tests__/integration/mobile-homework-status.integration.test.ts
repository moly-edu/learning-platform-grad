import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSessionMock, getStatusMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getStatusMock: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/server/courses", () => ({
  _getStudentHomeworkStatusByClassInternal: getStatusMock,
}));

import { GET } from "@/app/api/mobile/class/homework-status/route";

describe("GET /api/mobile/class/homework-status", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getStatusMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/class/homework-status?classId=c1&courseId=co1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when classId or courseId is missing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    const response = await GET(new NextRequest("http://localhost/api/mobile/class/homework-status?classId=c1"));
    expect(response.status).toBe(400);
  });

  it("returns the server-layer status result", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    getStatusMock.mockResolvedValue({ success: true, data: { assignedByLessonNode: { hw1: 2 } } });
    const response = await GET(new NextRequest("http://localhost/api/mobile/class/homework-status?classId=c1&courseId=co1"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { assignedByLessonNode: { hw1: 2 } },
    });
  });
});
