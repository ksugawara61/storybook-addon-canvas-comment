import { describe, expect, it } from "vitest";
import { filterCanvasComments, parseViewport, scalePoint } from "./dom-map";
import type { CanvasComment } from "./types";

const createComment = (
  overrides: Partial<CanvasComment> = {},
): CanvasComment => ({
  createdAt: "2026-06-12T00:00:00.000Z",
  id: "comment-1",
  note: "Spacing looks tight",
  pointer: { x: 100, y: 200 },
  rect: { height: 40, width: 80, x: 80, y: 180 },
  selector: "#target",
  status: "open",
  storyId: "button--default",
  storyName: "Default",
  storyTitle: "Button",
  viewport: { height: 800, width: 400 },
  ...overrides,
});

describe("filterCanvasComments", () => {
  it("filters by story id and status", () => {
    const comments = [
      createComment(),
      createComment({
        id: "comment-2",
        status: "resolved",
      }),
      createComment({
        id: "comment-3",
        storyId: "card--default",
      }),
    ];

    expect(
      filterCanvasComments(comments, {
        status: "open",
        storyId: "button--default",
      }).map((comment) => comment.id),
    ).toEqual(["comment-1"]);
  });

  it("keeps all statuses when requested", () => {
    const comments = [
      createComment(),
      createComment({ id: "comment-2", status: "resolved" }),
    ];

    expect(
      filterCanvasComments(comments, {
        status: "all",
      }).map((comment) => comment.id),
    ).toEqual(["comment-1", "comment-2"]);
  });
});

describe("parseViewport", () => {
  it("parses width and height", () => {
    expect(parseViewport("390x844")).toEqual({ height: 844, width: 390 });
  });

  it("rejects invalid values", () => {
    expect(() => parseViewport("390")).toThrow(
      'Invalid viewport "390". Expected <width>x<height>.',
    );
  });
});

describe("scalePoint", () => {
  it("scales a stored pointer into the target viewport", () => {
    expect(
      scalePoint(
        { x: 100, y: 200 },
        { height: 800, width: 400 },
        { height: 400, width: 200 },
      ),
    ).toEqual({ x: 50, y: 100 });
  });

  it("clamps near the viewport edges", () => {
    expect(
      scalePoint(
        { x: 0, y: 1000 },
        { height: 1000, width: 1000 },
        { height: 100, width: 100 },
      ),
    ).toEqual({ x: 8, y: 92 });
  });
});
