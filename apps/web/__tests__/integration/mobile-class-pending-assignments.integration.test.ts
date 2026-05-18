import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getSessionMock,
  classMemberFindUniqueMock,
  studentAssignmentFindManyMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  classMemberFindUniqueMock: vi.fn(),
  studentAssignmentFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    classMember: { findUnique: classMemberFindUniqueMock },
    studentAssignment: { findMany: studentAssignmentFindManyMock },
  },
}));

import { GET } from "@/app/api/mobile/class/pending-assignments/route";

describe("GET /api/mobile/class/pending-assignments", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    classMemberFindUniqueMock.mockReset();
    studentAssignmentFindManyMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/class/pending-assignments?classId=c1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when classId is missing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    const response = await GET(new NextRequest("http://localhost/api/mobile/class/pending-assignments"));
    expect(response.status).toBe(400);
  });

  it("returns 403 when user is not in the class", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    classMemberFindUniqueMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/class/pending-assignments?classId=c1"));
    expect(response.status).toBe(403);
  });

  it("formats pending assignments for the student", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    classMemberFindUniqueMock.mockResolvedValue({ role: "student" });
    studentAssignmentFindManyMock.mockResolvedValue([
      {
        id: "sa1",
        assignmentId: "a1",
        assignment: {
          lessonNode: {
            title: "Exercise 1",
            parent: { title: "Lesson 1" },
          },
        },
      },
      {
        id: "sa2",
        assignmentId: "a2",
        assignment: {
          lessonNode: {
            title: "Exercise 2",
            parent: null,
          },
        },
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/mobile/class/pending-assignments?classId=c1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          assignmentId: "a1",
          studentAssignmentId: "sa1",
          title: "Assignment 1",
          homeworkTitle: "Lesson 1",
        },
        {
          assignmentId: "a2",
          studentAssignmentId: "sa2",
          title: "Assignment 2",
          homeworkTitle: "Exercise 2",
        },
      ],
    });
  });
});
