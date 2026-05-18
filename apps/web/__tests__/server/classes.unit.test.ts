import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassRole } from "@repo/db";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    classMember: {
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/lib/auth-server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/server/members", () => ({
  checkUserInOrg: vi.fn(),
}));

import { _getUserClassesByUserId } from "@/server/classes";

describe("_getUserClassesByUserId", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("groups classes by role while preserving each role bucket", async () => {
    const now = new Date("2026-05-18T10:00:00.000Z");

    findManyMock.mockResolvedValue([
      {
        role: ClassRole.owner,
        joinedAt: now,
        class: { id: "class-owner", name: "Owner Class", course: {}, _count: { members: 3 } },
      },
      {
        role: ClassRole.teacher,
        joinedAt: now,
        class: { id: "class-teacher", name: "Teacher Class", course: {}, _count: { members: 5 } },
      },
      {
        role: ClassRole.student,
        joinedAt: now,
        class: { id: "class-student", name: "Student Class", course: {}, _count: { members: 20 } },
      },
    ]);

    const result = await _getUserClassesByUserId("user-1");

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
      },
      include: {
        class: {
          include: {
            course: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    expect(result).toEqual({
      owner: [
        expect.objectContaining({
          id: "class-owner",
          role: ClassRole.owner,
          joinedAt: now,
        }),
      ],
      teacher: [
        expect.objectContaining({
          id: "class-teacher",
          role: ClassRole.teacher,
          joinedAt: now,
        }),
      ],
      student: [
        expect.objectContaining({
          id: "class-student",
          role: ClassRole.student,
          joinedAt: now,
        }),
      ],
    });
  });
});
