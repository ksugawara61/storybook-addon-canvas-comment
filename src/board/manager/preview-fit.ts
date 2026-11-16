/**
 * Fits the story in a placed component's iframe to the component's box.
 *
 * The board lets the story root take the height of its content, so it can measure that height.
 * A story whose content is all out of flow, such as a floating action button positioned with
 * `position: absolute; right: 20px; bottom: 24px`, has a root of height 0: the content is placed
 * against that empty box, above the top of the iframe, and the component shows nothing.
 * Such a story is switched to fill mode instead, where the root fills the iframe like a screen.
 */

/** Class on the preview's `<html>` that makes the story root fill the iframe. */
export const FILL_CLASS = "canvas-comments-fill";

export const FILL_CSS = `
html.${FILL_CLASS}, html.${FILL_CLASS} body, html.${FILL_CLASS} body.sb-show-main #storybook-root { height: 100% !important; }
html.${FILL_CLASS} body.sb-show-main #storybook-root { display: flex !important; flex-direction: column !important; }
`;

type Box = { bottom: number; top: number };

/** Height of the root's content in flow, from the bottoms of its children. */
export const flowHeight = (root: Element): number =>
  Math.ceil(
    Math.max(
      0,
      ...Array.from(root.children).map(
        (child) => child.getBoundingClientRect().bottom,
      ),
    ),
  );

const isTransparent = (color: string): boolean =>
  color === "transparent" || /rgba\(.*,\s*0\)$/.test(color);

const hasBorder = (style: CSSStyleDeclaration): boolean =>
  ["top", "right", "bottom", "left"].some(
    (side) =>
      Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
      style.getPropertyValue(`border-${side}-style`) !== "none",
  );

const REPLACED = new Set([
  "CANVAS",
  "IFRAME",
  "IMG",
  "INPUT",
  "SELECT",
  "SVG",
  "TEXTAREA",
  "VIDEO",
]);

/** Whether the element draws something itself: text, a replaced element, a background, a border or a shadow. */
const paintsItself = (element: Element, style: CSSStyleDeclaration): boolean =>
  REPLACED.has(element.tagName.toUpperCase()) ||
  Array.from(element.childNodes).some(
    (node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "",
  ) ||
  !isTransparent(style.backgroundColor) ||
  (style.backgroundImage !== "" && style.backgroundImage !== "none") ||
  (style.boxShadow !== "" && style.boxShadow !== "none") ||
  hasBorder(style);

/** Hidden with `opacity: 0` or `visibility: hidden` on itself or an ancestor, as a closed menu's items are. */
const isHidden = (element: Element): boolean =>
  typeof element.checkVisibility === "function" &&
  !element.checkVisibility({
    checkOpacity: true,
    checkVisibilityCSS: true,
    opacityProperty: true,
    visibilityProperty: true,
  });

/**
 * Boxes of the visible elements under the root that draw something.
 * Wrappers that draw nothing are left out, so an empty container laid out
 * around hidden content does not count.
 */
export const paintedBoxes = (root: Element): Box[] => {
  const view = root.ownerDocument.defaultView;
  if (!view) {
    return [];
  }
  return Array.from(root.querySelectorAll("*")).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || isHidden(element)) {
      return [];
    }
    return paintsItself(element, view.getComputedStyle(element))
      ? [{ bottom: rect.bottom, top: rect.top }]
      : [];
  });
};

/**
 * Height that shows every painted box once the root fills the iframe.
 * Content above the top is anchored to the bottom, like a floating action button,
 * and comes down by as much as the iframe grows; content below the bottom is anchored to the top.
 */
export const fillHeight = (viewportHeight: number, boxes: Box[]): number =>
  Math.ceil(
    Math.max(viewportHeight, ...boxes.map((box) => box.bottom)) -
      Math.min(0, ...boxes.map((box) => box.top)),
  );

/**
 * Fits the root once it has content: content in flow keeps the root at its height,
 * and content that is all out of flow switches the preview to fill mode.
 * Returns the height that shows the story, or undefined while nothing is rendered.
 */
export const fitRoot = (doc: Document, root: Element): number | undefined => {
  const height = flowHeight(root);
  if (height > 0) {
    return height;
  }
  if (paintedBoxes(root).length === 0) {
    return undefined;
  }
  doc.documentElement.classList.add(FILL_CLASS);
  return fillHeight(doc.defaultView?.innerHeight ?? 0, paintedBoxes(root));
};
