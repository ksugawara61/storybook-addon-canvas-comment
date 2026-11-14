// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createA11yAnchor } from "./a11y-anchor";
import { resolveCommentPoint } from "./comment-point";
import { query, renderStory, setRect, storyRoot } from "./test/dom";
import type { CanvasComment } from "./types";

const VIEWPORT = { height: 800, width: 400 };
const VIEWPORT_RECT = { ...VIEWPORT, x: 0, y: 0 };

const createComment = (
  overrides: Partial<CanvasComment> = {},
): CanvasComment => ({
  createdAt: "2026-06-12T00:00:00.000Z",
  id: "comment-1",
  note: "Spacing looks tight",
  // Stored click: 25% across, 50% down a 40x20 box at (80, 180).
  pointer: { x: 90, y: 190 },
  rect: { height: 20, width: 40, x: 80, y: 180 },
  selector: "div > div:nth-of-type(2)",
  status: "open",
  storyId: "button--default",
  storyName: "Default",
  storyTitle: "Button",
  viewport: { height: 400, width: 200 },
  ...overrides,
});

const withA11yAnchor = (selector: string): Partial<CanvasComment> => {
  const a11yAnchor = createA11yAnchor(
    query(selector),
    { x: 90, y: 190 },
    storyRoot(),
  );

  return {
    domContext: {
      a11yAnchor,
      capturedAt: "2026-06-12T00:00:00.000Z",
      domTree: {
        attributes: {},
        commentIds: [],
        rect: VIEWPORT_RECT,
        selector: "",
        tagName: "div",
      },
      target: {
        ancestors: [],
        attributes: {},
        domPath: "",
        rect: VIEWPORT_RECT,
        selector: "",
        tagName: "div",
      },
      viewport: VIEWPORT,
    },
  };
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("resolveCommentPoint", () => {
  it("places the pin on the accessibility-tree anchor after it moves", () => {
    renderStory(`<button id="save">Save</button>`);
    setRect(query("#save"), { height: 20, width: 40, x: 80, y: 180 });
    const comment = createComment(withA11yAnchor("#save"));

    setRect(query("#save"), { height: 40, width: 80, x: 0, y: 500 });

    expect(resolveCommentPoint(comment, storyRoot(), VIEWPORT)).toEqual({
      x: 20,
      y: 520,
    });
  });

  it("falls back to an id selector when the anchor no longer resolves", () => {
    renderStory(`<button id="save">Save</button>`);
    setRect(query("#save"), { height: 20, width: 40, x: 80, y: 180 });
    const comment = createComment({
      ...withA11yAnchor("#save"),
      selector: "#save",
    });

    query("#save").textContent = "Submit";
    setRect(query("#save"), { height: 40, width: 80, x: 0, y: 500 });

    expect(resolveCommentPoint(comment, storyRoot(), VIEWPORT)).toEqual({
      x: 20,
      y: 520,
    });
  });

  it("scales the stored pointer instead of trusting a positional selector", () => {
    renderStory(`<div><div></div><div id="other"></div></div>`);
    setRect(query("#other"), { height: 40, width: 80, x: 0, y: 500 });

    expect(resolveCommentPoint(createComment(), storyRoot(), VIEWPORT)).toEqual(
      { x: 180, y: 380 },
    );
  });
});
