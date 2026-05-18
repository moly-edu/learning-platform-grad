import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getSessionMock,
  classMemberFindUniqueMock,
  classLessonNodeFindManyMock,
  studentAssignmentFindManyMock,
  stripGeneratorMetaMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  classMemberFindUniqueMock: vi.fn(),
  classLessonNodeFindManyMock: vi.fn(),
  studentAssignmentFindManyMock: vi.fn(),
  stripGeneratorMetaMock: vi.fn((value) => value),
}));

vi.mock("@/lib/auth-server", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    classMember: { findUnique: classMemberFindUniqueMock },
    classLessonNode: { findMany: classLessonNodeFindManyMock },
    studentAssignment: { findMany: studentAssignmentFindManyMock },
  },
}));

vi.mock("@/lib/widget-assignment-generator", () => ({
  stripGeneratorMeta: stripGeneratorMetaMock,
}));

import { GET } from "@/app/api/mobile/homework/assignments/route";

describe("GET /api/mobile/homework/assignments", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    classMemberFindUniqueMock.mockReset();
    classLessonNodeFindManyMock.mockReset();
    studentAssignmentFindManyMock.mockReset();
    stripGeneratorMetaMock.mockClear();
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/homework/assignments?classId=c1&homeworkNodeId=h1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when required params are missing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    const response = await GET(new NextRequest("http://localhost/api/mobile/homework/assignments?classId=c1"));
    expect(response.status).toBe(400);
  });

  it("returns 403 when membership is missing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    classMemberFindUniqueMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/mobile/homework/assignments?classId=c1&homeworkNodeId=h1"));
    expect(response.status).toBe(403);
  });

  it("returns only assigned assignments sorted with incomplete first", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    classMemberFindUniqueMock.mockResolvedValue({ role: "student" });
    classLessonNodeFindManyMock.mockResolvedValue([
      { id: "a2", content: { title: "Second" }, createdAt: "2026-05-19T10:01:00.000Z" },
      { id: "a1", content: { title: "First" }, createdAt: "2026-05-19T10:00:00.000Z" },
    ]);
    studentAssignmentFindManyMock.mockResolvedValue([
      {
        assignmentId: "a1",
        submissionData: { evaluation: { score: 2 } },
        submittedAt: new Date("2026-05-19T11:00:00.000Z"),
        latestSubmittedAt: new Date("2026-05-19T11:10:00.000Z"),
        attemptCount: 2,
        correctAttemptCount: 1,
        attempts: [{ submissionData: { evaluation: { score: 1 } } }, { submissionData: { evaluation: { score: 4 } } }],
      },
      {
        assignmentId: "a2",
        submissionData: null,
        submittedAt: null,
        latestSubmittedAt: null,
        attemptCount: 0,
        correctAttemptCount: 0,
        attempts: [],
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/mobile/homework/assignments?classId=c1&homeworkNodeId=h1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.map((item: any) => item.id)).toEqual(["a2", "a1"]);
    expect(body.data[1].highestScore).toBe(4);
  });
});
