import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSessionMock, getUserClassesMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getUserClassesMock: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/server/classes", () => ({
  _getUserClassesByUserId: getUserClassesMock,
}));

import { GET } from "@/app/api/mobile/classes/route";

describe("GET /api/mobile/classes", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getUserClassesMock.mockReset();
  });

  it("returns 401 when the mobile request is unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/mobile/classes");
    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized - Please sign in first",
    });
  });

  it("returns only student classes for the authenticated mobile user", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    getUserClassesMock.mockResolvedValue({
      owner: [{ id: "class-owner" }],
      teacher: [{ id: "class-teacher" }],
      student: [{ id: "class-student" }],
    });

    const request = new NextRequest("http://localhost/api/mobile/classes");
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ id: "class-student" }],
    });
    expect(getUserClassesMock).toHaveBeenCalledWith("user-1");
  });

  it("returns a normalized 401 payload when the server layer throws", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    getUserClassesMock.mockRejectedValue(new Error("db failed"));

    const request = new NextRequest("http://localhost/api/mobile/classes");
    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "db failed",
    });
  });
});
