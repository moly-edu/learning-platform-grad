import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    widget: {
      findMany: findManyMock,
    },
  },
}));

import { POST } from "@/app/api/widgets/search/route";

describe("POST /api/widgets/search", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("returns matching widgets using case-insensitive name search", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "widget-1",
        name: "Calculator",
      },
    ]);

    const request = new NextRequest("http://localhost/api/widgets/search", {
      method: "POST",
      body: JSON.stringify({ query: "calc" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "widget-1",
        name: "Calculator",
      },
    ]);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        name: {
          contains: "calc",
          mode: "insensitive",
        },
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
        builds: {
          orderBy: { version: "desc" },
          take: 1,
          where: { status: "success" },
        },
        _count: { select: { builds: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("returns 500 when widget search fails", async () => {
    findManyMock.mockRejectedValue(new Error("db offline"));

    const request = new NextRequest("http://localhost/api/widgets/search", {
      method: "POST",
      body: JSON.stringify({ query: "calc" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Search failed",
    });
  });
});
