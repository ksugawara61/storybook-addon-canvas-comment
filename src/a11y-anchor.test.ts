// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createA11yAnchor,
  pointInElement,
  resolveA11yAnchor,
} from "./a11y-anchor";
import { query, renderStory, setRect, storyRoot } from "./test/dom";

const anchorFor = (selector: string, point = { x: 0, y: 0 }) => {
  const anchor = createA11yAnchor(query(selector), point, storyRoot());
  if (!anchor) throw new Error(`No anchor for ${selector}`);
  return anchor;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createA11yAnchor", () => {
  it("anchors a click on inner text to the nearest named element", () => {
    renderStory(
      `<section aria-label="Shopping list"><div role="button" aria-label="Delete"><span id="icon">x</span></div></section>`,
    );
    setRect(query("[role=button]"), { height: 20, width: 40, x: 100, y: 200 });

    expect(anchorFor("#icon", { x: 110, y: 215 })).toEqual({
      ancestors: [{ name: "Shopping list", role: "region" }],
      index: 0,
      name: "Delete",
      offset: { x: 0.25, y: 0.75 },
      role: "button",
    });
  });

  it("returns undefined when nothing up to the story root is named", () => {
    renderStory(`<div><span id="text">Plain text</span></div>`);

    expect(
      createA11yAnchor(query("#text"), { x: 0, y: 0 }, storyRoot()),
    ).toBeUndefined();
  });
});

describe("resolveA11yAnchor", () => {
  it("follows the element after the layout moves and resizes it", () => {
    renderStory("<button>Save</button>");
    const button = query("button");
    setRect(button, { height: 40, width: 100, x: 0, y: 0 });
    const anchor = anchorFor("button", { x: 50, y: 10 });

    storyRoot().insertAdjacentHTML("afterbegin", "<p>New banner</p>");
    setRect(button, { height: 80, width: 200, x: 20, y: 300 });
    const resolved = resolveA11yAnchor(anchor, storyRoot());

    expect(resolved).toBe(button);
    expect(resolved && pointInElement(resolved, anchor.offset)).toEqual({
      x: 120,
      y: 320,
    });
  });

  it("tells same-named buttons apart by their named ancestors", () => {
    renderStory(
      `<section aria-label="Milk"><button>Delete</button></section><section aria-label="Eggs"><button id="target">Delete</button></section>`,
    );
    const anchor = anchorFor("#target");

    // A new item is added before the commented one.
    storyRoot().insertAdjacentHTML(
      "afterbegin",
      `<section aria-label="Bread"><button>Delete</button></section>`,
    );

    expect(resolveA11yAnchor(anchor, storyRoot())).toBe(query("#target"));
  });

  it("uses the index among identical matches", () => {
    renderStory(`<button>Add</button><button id="target">Add</button>`);

    expect(resolveA11yAnchor(anchorFor("#target"), storyRoot())).toBe(
      query("#target"),
    );
  });

  it("returns null when the accessible name has changed", () => {
    renderStory("<button>Save</button>");
    const anchor = anchorFor("button");

    query("button").textContent = "Submit";

    expect(resolveA11yAnchor(anchor, storyRoot())).toBeNull();
  });

  it("ignores the comment overlay", () => {
    renderStory(`<button id="target">Save</button>`);
    const anchor = anchorFor("#target");

    storyRoot().insertAdjacentHTML(
      "afterbegin",
      `<div data-canvas-comments-overlay="true"><button>Save</button></div>`,
    );

    expect(resolveA11yAnchor(anchor, storyRoot())).toBe(query("#target"));
  });
});
