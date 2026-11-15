// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildSelector,
  describeElement,
  pickTarget,
} from "./element-selector.ts";

const render = (html: string): HTMLElement => {
  document.body.innerHTML = `<div id="storybook-root">${html}</div>`;
  const root = document.getElementById("storybook-root");
  if (!root) {
    throw new Error("root not rendered");
  }
  return root;
};

describe("buildSelector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it.each([
    [
      "an element with same-tag siblings",
      "<div><p>a</p><p>b</p><p class='target'>c</p></div>",
    ],
    [
      "a deeply nested element",
      "<div><div><span><b class='target'>x</b></span></div></div>",
    ],
    [
      "an element under an ancestor with an id",
      "<section id='card'><div></div><div><i class='target'></i></div></section>",
    ],
  ])("returns a selector that uniquely matches %s", (_, html) => {
    const root = render(html);
    const target = root.querySelector(".target");
    if (!target) {
      throw new Error("target not rendered");
    }

    expect(document.querySelector(buildSelector(target, root))).toBe(target);
  });
});

describe("describeElement", () => {
  it.each([
    [
      "prefers aria-label",
      "<button aria-label='Save draft'>💾</button>",
      'button "Save draft"',
    ],
    ["uses an explicit role", "<div role='tab'>Overview</div>", 'tab "Overview"'],
    [
      "collapses whitespace in the text content",
      "<a>\n  Read\n  more </a>",
      'link "Read more"',
    ],
    ["returns only the role without a name", "<ul></ul>", "list"],
    [
      "truncates long text",
      `<p>${"a".repeat(50)}</p>`,
      `p "${"a".repeat(40)}…"`,
    ],
  ])("%s", (_, html, expected) => {
    const root = render(html);
    const element = root.firstElementChild;
    if (!element) {
      throw new Error("element not rendered");
    }

    expect(describeElement(element)).toBe(expected);
  });
});

describe("pickTarget", () => {
  const find = (root: HTMLElement, selector: string): Element => {
    const element = root.querySelector(selector);
    if (!element) {
      throw new Error(`${selector} not rendered`);
    }
    return element;
  };

  it.each([
    {
      expected: "[role=button]",
      html: "<div role='button'><div><span class='hit'>Add</span></div></div>",
      name: "picks the interactive ancestor",
      parent: false,
    },
    {
      expected: ".hit",
      html: "<div><div><span class='hit'>Heading</span></div></div>",
      name: "picks the pressed element without an interactive ancestor",
      parent: false,
    },
    {
      expected: ".row",
      html: "<div class='row'><div tabindex='0'><span class='hit'>x</span></div></div>",
      name: "picks the parent with the parent option",
      parent: true,
    },
  ])("$name", ({ expected, html, parent }) => {
    const root = render(html);

    expect(pickTarget(find(root, ".hit"), root, { parent })).toBe(
      find(root, expected),
    );
  });

  it("never picks the story root itself", () => {
    const root = render("<span class='hit'>x</span>");

    expect(
      pickTarget(find(root, ".hit"), root, { parent: true }),
    ).toBeUndefined();
  });
});
