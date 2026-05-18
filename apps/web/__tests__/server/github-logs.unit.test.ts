import { describe, expect, it } from "vitest";
import { mapLogsToSteps } from "@/lib/github/github-logs";

describe("mapLogsToSteps", () => {
  it("maps logs into step sections and computes duration", () => {
    const steps = [
      {
        number: 1,
        name: "Install",
        status: "completed",
        conclusion: "success",
        started_at: "2026-05-19T10:00:00.000Z",
        completed_at: "2026-05-19T10:00:10.000Z",
      },
    ];

    const rawLogs = [
      "2026-05-19T10:00:01.000Z ##[group]Dependencies",
      "2026-05-19T10:00:02.000Z npm install",
      "2026-05-19T10:00:03.000Z ##[endgroup]",
      "2026-05-19T10:00:04.000Z done",
    ].join("\n");

    const result = mapLogsToSteps(steps, rawLogs);

    expect(result[0].duration).toBe(10);
    expect(result[0].logs).toEqual([
      {
        type: "group",
        title: "Dependencies",
        lines: ["npm install"],
        collapsed: false,
      },
      {
        type: "line",
        lines: ["done"],
      },
    ]);
  });

  it("returns empty logs for steps without a start time", () => {
    const result = mapLogsToSteps(
      [
        {
          number: 1,
          name: "Queued",
          status: "queued",
          conclusion: null,
          started_at: null,
          completed_at: null,
        },
      ],
      "2026-05-19T10:00:01.000Z ignored",
    );

    expect(result[0].logs).toEqual([]);
    expect(result[0].duration).toBeNull();
  });

  it("uses the next step start as boundary for unfinished steps", () => {
    const steps = [
      {
        number: 1,
        name: "Build",
        status: "in_progress",
        conclusion: null,
        started_at: "2026-05-19T10:00:00.000Z",
        completed_at: null,
      },
      {
        number: 2,
        name: "Test",
        status: "queued",
        conclusion: null,
        started_at: "2026-05-19T10:00:05.000Z",
        completed_at: null,
      },
    ];

    const rawLogs = [
      "2026-05-19T10:00:01.000Z build-1",
      "2026-05-19T10:00:04.000Z build-2",
      "2026-05-19T10:00:06.000Z test-1",
    ].join("\n");

    const result = mapLogsToSteps(steps, rawLogs);

    expect(result[0].logs).toEqual([
      { type: "line", lines: ["build-1"] },
      { type: "line", lines: ["build-2"] },
    ]);
    expect(result[1].logs).toEqual([]);
  });
});
