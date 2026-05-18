import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getSessionMock,
  classMemberFindUniqueMock,
  classFindUniqueMock,
  lessonNodeFindManyMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  classMemberFindUniqueMock: vi.fn(),
  classFindUniqueMock: vi.fn(),
  lessonNodeFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
  auth: {
    api: { getSession: getSessionMock },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    classMember: { findUnique: classMemberFindUniqueMock },
    class: { findUnique: classFindUniqueMock },
    lessonNode: { findMany: lessonNodeFindManyMock },
  },
}));

import { GET } from "@/app/api/mobile/class/route";

describe("GET /api/mobile/class", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    classMemberFindUniqueMock.mockReset();
    classFindUniqueMock.mockReset();
    lessonNodeFindManyMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/class?classId=c1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when classId is missing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    const response = await GET(new NextRequest("http://localhost/api/mobile/class"));
    expect(response.status).toBe(400);
  });

  it("returns 403 when user is not a class member", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    classMemberFindUniqueMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/class?classId=c1"));
    expect(response.status).toBe(403);
  });

  it("returns class payload with nodes when authorized", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    classMemberFindUniqueMock.mockResolvedValue({ role: "student" });
    classFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Class A",
      createdAt: "x",
      updatedAt: "y",
      members: [],
      course: { id: "course-1", name: "Course", rootLessonNodeId: "root", createdBy: "u2", createdAt: "a", updatedAt: "b" },
    });
    lessonNodeFindManyMock.mockResolvedValue([{ id: "n1", title: "Node 1" }]);

    const response = await GET(new NextRequest("http://localhost/api/mobile/class?classId=c1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        classData: {
          id: "c1",
          name: "Class A",
          createdAt: "x",
          updatedAt: "y",
          members: [],
          course: { id: "course-1", name: "Course", rootLessonNodeId: "root", createdBy: "u2", createdAt: "a", updatedAt: "b" },
        },
        nodes: [{ id: "n1", title: "Node 1" }],
      },
      role: "student",
    });
  });
});
