import { describe, expect, it } from "vitest";
import { readReviewStatus } from "./review-schema";

describe("readReviewStatus", () => {
  it.each([
    {
      expected: "reviewing",
      input: { status: "reviewing" },
      name: "reads reviewing status",
    },
    {
      expected: "completed",
      input: { status: "completed" },
      name: "reads completed status",
    },
    {
      expected: undefined,
      input: { status: "done" },
      name: "rejects unknown status",
    },
    { expected: undefined, input: {}, name: "rejects missing status" },
    { expected: undefined, input: "completed", name: "rejects non-object" },
    { expected: undefined, input: null, name: "rejects null" },
  ])("$name", ({ input, expected }) => {
    expect(readReviewStatus(input)).toBe(expected);
  });
});
