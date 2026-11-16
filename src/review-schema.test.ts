import { describe, expect, it } from "vitest";
import { parseReviewState, readReviewStatus } from "./review-schema";

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

describe("parseReviewState", () => {
  it("reads a stored review", () => {
    expect(
      parseReviewState({ status: "completed", updatedAt: "2026-11-16T00:00:00.000Z" }),
    ).toEqual({ status: "completed", updatedAt: "2026-11-16T00:00:00.000Z" });
  });

  it.each([undefined, null, { status: "done" }, "completed"])(
    "reads %j as a review that has not completed",
    (input) => {
      expect(parseReviewState(input)).toEqual({
        status: "reviewing",
        updatedAt: null,
      });
    },
  );
});
