// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { query, renderStory, setRect, storyRoot } from "../../test/dom.ts";
import {
  FILL_CLASS,
  fillHeight,
  fitRoot,
  paintedBoxes,
} from "./preview-fit.ts";

const box = (selector: string, y: number, height: number) =>
  setRect(query(selector), { height, width: 56, x: 0, y });

afterEach(() => {
  document.documentElement.classList.remove(FILL_CLASS);
});

describe("fillHeight", () => {
  it("keeps the iframe's height when the content is inside it", () => {
    expect(fillHeight(64, [{ bottom: 50, top: 10 }])).toBe(64);
  });

  it("grows by the overflow above the top, for content anchored to the bottom", () => {
    // A 56px button 24px above the bottom of a 64px iframe starts at -16.
    expect(fillHeight(64, [{ bottom: 40, top: -16 }])).toBe(80);
  });

  it("grows to the bottom of content below it, for content anchored to the top", () => {
    expect(fillHeight(64, [{ bottom: 120.5, top: 0 }])).toBe(121);
  });
});

describe("paintedBoxes", () => {
  it("counts text, backgrounds and borders but not empty wrappers", () => {
    renderStory(
      '<div id="wrapper"><div id="text">Save</div><div id="fill" style="background-color: red"></div><div id="border" style="border: 1px solid black"></div><div id="empty"></div></div>',
    );
    box("#wrapper", -200, 300);
    box("#text", 0, 20);
    box("#fill", 20, 20);
    box("#border", 40, 20);
    box("#empty", -200, 20);

    expect(paintedBoxes(storyRoot())).toEqual([
      { bottom: 20, top: 0 },
      { bottom: 40, top: 20 },
      { bottom: 60, top: 40 },
    ]);
  });

  it("leaves out elements without a box", () => {
    renderStory('<div id="text">Save</div>');

    expect(paintedBoxes(storyRoot())).toEqual([]);
  });

  it("leaves out elements hidden with opacity, such as a closed menu's items", () => {
    renderStory('<div style="opacity: 0"><div id="item">Memo</div></div>');
    box("#item", -120, 40);
    const item = query("#item");
    item.checkVisibility = (options) =>
      !(options?.opacityProperty || options?.checkOpacity);

    expect(paintedBoxes(storyRoot())).toEqual([]);
  });
});

describe("fitRoot", () => {
  it("returns the height of content in flow and leaves the root as it is", () => {
    renderStory('<button id="button">Save</button>');
    box("#button", 0, 32);

    expect(fitRoot(document, storyRoot())).toBe(32);
    expect(document.documentElement.classList.contains(FILL_CLASS)).toBe(false);
  });

  it("waits while nothing is rendered", () => {
    renderStory('<div id="wrapper"></div>');
    box("#wrapper", 0, 0);

    expect(fitRoot(document, storyRoot())).toBeUndefined();
    expect(document.documentElement.classList.contains(FILL_CLASS)).toBe(false);
  });

  it("fills the iframe when the content is all out of flow, like a floating action button", () => {
    renderStory(
      '<div id="wrapper"><div id="fab" style="position: absolute; background-color: blue"></div></div>',
    );
    box("#wrapper", 0, 0);
    // Placed against the empty root: 24px above its bottom, so above the iframe.
    box("#fab", -80, 56);
    const fab = query("#fab");
    const classList = document.documentElement.classList;
    // Once the root fills the 768px jsdom window, the button is 24px above its bottom.
    fab.getBoundingClientRect = () =>
      classList.contains(FILL_CLASS)
        ? new DOMRect(0, window.innerHeight - 80, 56, 56)
        : new DOMRect(0, -80, 56, 56);

    expect(fitRoot(document, storyRoot())).toBe(window.innerHeight);
    expect(classList.contains(FILL_CLASS)).toBe(true);
  });
});
