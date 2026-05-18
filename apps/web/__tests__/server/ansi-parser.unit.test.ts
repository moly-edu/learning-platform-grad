import { describe, expect, it } from "vitest";
import {
  parseAnsiToStyledSegments,
  stripAnsiCodes,
} from "@/lib/github/ansi-parser";

describe("ansi parser", () => {
  it("strips ansi codes from plain text output", () => {
    expect(stripAnsiCodes("\u001b[31mError\u001b[0m done")).toBe("Error done");
  });

  it("parses styled segments for colored text", () => {
    expect(parseAnsiToStyledSegments("A \u001b[31mred\u001b[0m B")).toEqual([
      { text: "A ", classes: [] },
      { text: "red", classes: ["text-red-500"] },
      { text: " B", classes: [] },
    ]);
  });

  it("replaces foreground color while preserving styles", () => {
    expect(
      parseAnsiToStyledSegments("\u001b[1;31mBold red\u001b[32m green"),
    ).toEqual([
      { text: "Bold red", classes: ["font-bold", "text-red-500"] },
      { text: " green", classes: ["font-bold", "text-green-500"] },
    ]);
  });

  it("resets only foreground color on code 39", () => {
    expect(parseAnsiToStyledSegments("\u001b[1;31mAlert\u001b[39m plain")).toEqual([
      { text: "Alert", classes: ["font-bold", "text-red-500"] },
      { text: " plain", classes: ["font-bold"] },
    ]);
  });
});
