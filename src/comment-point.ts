import { offsetRatio, pointInElement, resolveA11yAnchor } from "./a11y-anchor";
import { OVERLAY_ATTRIBUTE } from "./constants";
import type {
  CanvasComment,
  CanvasCommentPoint,
  CanvasCommentViewport,
} from "./types";

// Positional path selectors (`div.r-abc > div:nth-of-type(2)`) are not stable
// enough to move a pin onto; only attribute and id selectors are trusted here.
const isStableSelector = (selector: string) =>
  selector.startsWith("[") || selector.startsWith("#");

const findBySelector = (selector: string, root: Element) => {
  if (!isStableSelector(selector)) return null;

  try {
    const element = root.ownerDocument.querySelector(selector);
    return element?.closest(`[${OVERLAY_ATTRIBUTE}]`) ? null : element;
  } catch {
    return null;
  }
};

const scalePointer = (
  comment: CanvasComment,
  viewport: CanvasCommentViewport,
): CanvasCommentPoint => ({
  x: (comment.pointer.x / Math.max(comment.viewport.width, 1)) * viewport.width,
  y:
    (comment.pointer.y / Math.max(comment.viewport.height, 1)) *
    viewport.height,
});

/**
 * Where a comment's pin belongs in the current DOM. Resolution order:
 * accessibility-tree anchor → stable selector → pointer scaled to `viewport`.
 */
export const resolveCommentPoint = (
  comment: CanvasComment,
  root: Element,
  viewport: CanvasCommentViewport,
): CanvasCommentPoint => {
  const a11yAnchor = comment.domContext?.a11yAnchor;
  const a11yTarget = a11yAnchor ? resolveA11yAnchor(a11yAnchor, root) : null;

  if (a11yAnchor && a11yTarget) {
    return pointInElement(a11yTarget, a11yAnchor.offset);
  }

  const selectorTarget = findBySelector(comment.selector, root);

  if (selectorTarget) {
    return pointInElement(
      selectorTarget,
      offsetRatio(comment.pointer, comment.rect),
    );
  }

  return scalePointer(comment, viewport);
};
