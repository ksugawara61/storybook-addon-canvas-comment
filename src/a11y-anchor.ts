/**
 * Accessibility-tree anchors for canvas comments.
 *
 * A comment is anchored to the nearest element that has a role and an
 * accessible name (e.g. button "Save"), qualified by up to MAX_ANCESTORS
 * named ancestors and an index among identical matches. The pin position is
 * stored as a ratio inside that element, so pins follow the element when the
 * layout changes instead of staying at absolute viewport coordinates.
 *
 * Role and name are computed with dom-accessibility-api, the same library
 * Testing Library's getByRole uses, so anchors also resolve with Playwright's
 * getByRole on the dom-map side.
 */
import { computeAccessibleName, getRole } from "dom-accessibility-api";
import { OVERLAY_ATTRIBUTE } from "./constants";
import type {
  CanvasCommentA11yAnchor,
  CanvasCommentA11yNode,
  CanvasCommentPoint,
  CanvasCommentRect,
} from "./types";

const MAX_ANCESTORS = 3;
const OVERLAY_SELECTOR = `[${OVERLAY_ATTRIBUTE}]`;
const IGNORED_ROLES = new Set(["generic", "none", "presentation"]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Position of `point` inside `rect` as a 0–1 ratio (centre for empty boxes). */
export const offsetRatio = (
  point: CanvasCommentPoint,
  rect: CanvasCommentRect,
): CanvasCommentPoint => ({
  x: rect.width > 0 ? clamp((point.x - rect.x) / rect.width, 0, 1) : 0.5,
  y: rect.height > 0 ? clamp((point.y - rect.y) / rect.height, 0, 1) : 0.5,
});

/** `element` and its ancestors, innermost first, stopping before `root`. */
const chainUntil = (element: Element | null, root: Element): Element[] =>
  !element || element === root || !root.contains(element)
    ? []
    : [element, ...chainUntil(element.parentElement, root)];

const a11yNodeFor = (element: Element): CanvasCommentA11yNode | undefined => {
  const role = getRole(element);

  if (!role || IGNORED_ROLES.has(role)) {
    return undefined;
  }

  const name = computeAccessibleName(element).trim();
  return name ? { name, role } : undefined;
};

const isSameNode = (a: CanvasCommentA11yNode, b: CanvasCommentA11yNode) =>
  a.role === b.role && a.name === b.name;

/** Named ancestors of `element` inside `root`, outermost first. */
const namedAncestorsFor = (element: Element, root: Element) =>
  chainUntil(element.parentElement, root)
    .map(a11yNodeFor)
    .filter((node): node is CanvasCommentA11yNode => node !== undefined)
    .reverse();

/** True when `expected` appears in `actual` in the same order (gaps allowed). */
const containsInOrder = (
  actual: CanvasCommentA11yNode[],
  expected: CanvasCommentA11yNode[],
) =>
  actual.reduce((cursor, node) => {
    const next = expected[cursor];
    return next && isSameNode(node, next) ? cursor + 1 : cursor;
  }, 0) === expected.length;

const findMatches = (anchor: CanvasCommentA11yAnchor, root: Element) =>
  Array.from(root.querySelectorAll("*")).filter((element) => {
    // getRole is cheap; check it before computing the accessible name.
    if (getRole(element) !== anchor.role || element.closest(OVERLAY_SELECTOR)) {
      return false;
    }

    const node = a11yNodeFor(element);

    return (
      node !== undefined &&
      isSameNode(node, anchor) &&
      containsInOrder(namedAncestorsFor(element, root), anchor.ancestors)
    );
  });

const findAnchorElement = (target: Element, root: Element) =>
  chainUntil(target, root)
    .map((element) => ({ element, node: a11yNodeFor(element) }))
    .find(
      (entry): entry is { element: Element; node: CanvasCommentA11yNode } =>
        entry.node !== undefined,
    );

/**
 * Builds an anchor for a click on `target`. Returns undefined when neither the
 * target nor any ancestor inside `root` has both a role and an accessible name.
 */
export const createA11yAnchor = (
  target: Element,
  point: CanvasCommentPoint,
  root: Element,
): CanvasCommentA11yAnchor | undefined => {
  const found = findAnchorElement(target, root);

  if (!found) {
    return undefined;
  }

  const rect = found.element.getBoundingClientRect();
  const ancestors = namedAncestorsFor(found.element, root).slice(
    -MAX_ANCESTORS,
  );
  const anchor: CanvasCommentA11yAnchor = {
    ...found.node,
    ancestors,
    index: 0,
    offset: offsetRatio(point, rect),
  };

  return {
    ...anchor,
    index: Math.max(findMatches(anchor, root).indexOf(found.element), 0),
  };
};

/** Finds the element an anchor points to in the current DOM, or null. */
export const resolveA11yAnchor = (
  anchor: CanvasCommentA11yAnchor,
  root: Element,
): Element | null => findMatches(anchor, root)[anchor.index] ?? null;

/** Viewport point inside `element` at the anchor's stored offset ratio. */
export const pointInElement = (
  element: Element,
  offset: CanvasCommentPoint,
): CanvasCommentPoint => {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.x + rect.width * offset.x,
    y: rect.y + rect.height * offset.y,
  };
};
