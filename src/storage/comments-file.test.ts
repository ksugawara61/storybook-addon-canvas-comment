import { describe, expect, it } from "vitest";
import {
  createEmptyCommentsFile,
  parseCommentsFile,
  serializeCommentsFile,
} from "./comments-file";

const comment = {
  createdAt: "2026-06-12T00:00:00.000Z",
  id: "a",
  note: "Note",
  pointer: { x: 1, y: 2 },
  rect: { height: 4, width: 3, x: 1, y: 2 },
  selector: "#a",
  status: "open",
  storyId: "s",
  storyName: "n",
  storyTitle: "t",
  viewport: { height: 8, width: 4 },
};

describe("parseCommentsFile", () => {
  it("reads { comments, review }", () => {
    const review = {
      status: "completed",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    expect(parseCommentsFile({ comments: [comment], review })).toEqual({
      comments: [comment],
      review,
    });
  });

  it("accepts the legacy array format with the default review state", () => {
    expect(parseCommentsFile([comment, { invalid: true }])).toEqual({
      comments: [comment],
      review: { status: "reviewing", updatedAt: null },
    });
  });

  it.each([
    ["null", null],
    ["a string", "text"],
    ["an object without comments", { review: 1 }],
  ])("falls back to an empty file for %s", (_label, raw) => {
    expect(parseCommentsFile(raw)).toEqual(createEmptyCommentsFile());
  });

  it.each([
    {
      expected: { status: "reviewing", updatedAt: null },
      name: "an invalid review",
      review: { status: "bogus" },
    },
    {
      expected: { status: "completed", updatedAt: null },
      name: "a missing updatedAt",
      review: { status: "completed" },
    },
  ])("defaults $name", ({ expected, review }) => {
    expect(parseCommentsFile({ comments: [], review }).review).toEqual(
      expected,
    );
  });
});

describe("serializeCommentsFile", () => {
  it("round-trips through parseCommentsFile", () => {
    const file = {
      comments: [comment as never],
      review: {
        status: "completed" as const,
        updatedAt: "2026-06-14T00:00:00.000Z",
      },
    };
    const text = serializeCommentsFile(file);

    expect(text.endsWith("\n")).toBe(true);
    expect(parseCommentsFile(JSON.parse(text))).toEqual(file);
  });
});
