/**
 * Browser-agnostic DOM summarization utilities.
 *
 * This module has NO runtime imports so it can be used from two contexts:
 *   1. Directly imported by preview.ts (runs in the live browser).
 *   2. Bundled as an IIFE via esbuild.transform and injected into a Playwright
 *      page via page.addScriptTag — the entry point is exposed as
 *      `window.__canvasCommentsSummarizeTarget`.
 *
 * Keep this file free of runtime imports. Type-only imports are fine.
 */
import type {
  CanvasCommentRect,
  DomElementSummary,
  DomTreeNode,
} from "./types";

export type SummarizeStoryOptions = {
  /** The element that was clicked / annotated. Used to populate target and mark commentIds. */
  anchor: Element;
  /** Comment id to record in commentIds on the anchor node. */
  commentId: string;
  maxDomChildren?: number;
  maxDomDepth?: number;
  maxTextLength?: number;
};

export type SummarizeStoryResult = {
  domTree: DomTreeNode;
  target: DomElementSummary;
};

const OVERLAY_SELECTOR = "[data-canvas-comments-overlay]";
const DEFAULT_MAX_DOM_DEPTH = 6;
const DEFAULT_MAX_DOM_CHILDREN = 20;
const DEFAULT_MAX_TEXT_LENGTH = 240;

const isOverlayElement = (element: Element) =>
  element.closest(OVERLAY_SELECTOR) !== null;

const toRect = (element: Element): CanvasCommentRect => {
  const rect = element.getBoundingClientRect();
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
};

const escapeCss = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
};

const segmentFor = (element: Element) => {
  const tag = element.tagName.toLowerCase();
  const id = element.getAttribute("id");

  if (id) {
    return `${tag}#${escapeCss(id)}`;
  }

  const classPart = Array.from(element.classList)
    .filter((className) => !className.includes(":"))
    .slice(0, 2)
    .map((className) => `.${escapeCss(className)}`)
    .join("");
  const parent = element.parentElement;

  if (!parent) {
    return `${tag}${classPart}`;
  }

  const sameTagSiblings = Array.from(parent.children).filter(
    (child) => child.tagName === element.tagName,
  );

  if (sameTagSiblings.length <= 1 && classPart) {
    return `${tag}${classPart}`;
  }

  return `${tag}${classPart}:nth-of-type(${
    sameTagSiblings.indexOf(element) + 1
  })`;
};

const domPathFor = (element: Element) => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    segments.unshift(segmentFor(current));

    if (current.getAttribute("id") === "storybook-root") {
      break;
    }

    current = current.parentElement;
  }

  return segments.join(" > ") || element.tagName.toLowerCase();
};

const readAttributes = (element: Element) => {
  const attributeNames = [
    "id",
    "class",
    "role",
    "aria-label",
    "aria-labelledby",
    "data-testid",
    "data-ai-component",
    "data-ai-source",
    "href",
    "type",
    "name",
    "placeholder",
    "alt",
    "title",
  ];

  return attributeNames.reduce<Record<string, string>>((acc, name) => {
    const value = element.getAttribute(name);
    if (value) {
      acc[name] = value;
    }
    return acc;
  }, {});
};

const makeNormalizeText = (maxTextLength: number) => (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxTextLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxTextLength)}...`;
};

const textFor = (element: Element, normalizeText: (v: string) => string) => {
  const raw =
    element instanceof HTMLElement
      ? element.innerText
      : (element.textContent ?? "");
  const text = normalizeText(raw);
  return text ? text : undefined;
};

const ancestorSummariesFor = (
  element: Element,
): DomElementSummary["ancestors"] => {
  const ancestors: DomElementSummary["ancestors"] = [];
  let current = element.parentElement;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement &&
    ancestors.length < 6
  ) {
    ancestors.push({
      attributes: readAttributes(current),
      selector: domPathFor(current),
      tagName: current.tagName.toLowerCase(),
    });

    if (current.getAttribute("id") === "storybook-root") {
      break;
    }

    current = current.parentElement;
  }

  return ancestors;
};

const summarizeElement = (
  element: Element,
  normalizeText: (v: string) => string,
): DomElementSummary => {
  const role = element.getAttribute("role") ?? undefined;
  const ariaLabel = element.getAttribute("aria-label") ?? undefined;

  return {
    ancestors: ancestorSummariesFor(element),
    ariaLabel,
    attributes: readAttributes(element),
    domPath: domPathFor(element),
    rect: toRect(element),
    role,
    selector: domPathFor(element),
    tagName: element.tagName.toLowerCase(),
    text: textFor(element, normalizeText),
  };
};

const createDomTreeNode = (
  element: Element,
  commentIds: string[],
  normalizeText: (v: string) => string,
): DomTreeNode => ({
  attributes: readAttributes(element),
  commentIds,
  rect: toRect(element),
  selector: domPathFor(element),
  tagName: element.tagName.toLowerCase(),
  text: textFor(element, normalizeText),
});

const buildDomTree = (
  element: Element,
  depth: number,
  anchor: Element,
  commentId: string,
  maxDomDepth: number,
  maxDomChildren: number,
  normalizeText: (v: string) => string,
): DomTreeNode | undefined => {
  if (isOverlayElement(element)) {
    return undefined;
  }

  const rawChildren = Array.from(element.children).filter(
    (child) => !isOverlayElement(child),
  );
  const selectedChildren =
    depth >= maxDomDepth ? [] : rawChildren.slice(0, maxDomChildren);
  const children = selectedChildren
    .map((child) =>
      buildDomTree(
        child,
        depth + 1,
        anchor,
        commentId,
        maxDomDepth,
        maxDomChildren,
        normalizeText,
      ),
    )
    .filter((node): node is DomTreeNode => node !== undefined);
  const truncatedChildren = rawChildren.length - selectedChildren.length;
  const commentIds = element === anchor ? [commentId] : [];
  const node = createDomTreeNode(element, commentIds, normalizeText);

  if (children.length > 0) {
    node.children = children;
  }

  if (truncatedChildren > 0) {
    node.truncatedChildren = truncatedChildren;
  }

  return node;
};

/**
 * Summarize the clicked anchor element and its descendant subtree.
 *
 * @returns `{ target, domTree }` where `target` is a summary of the anchor
 *   element (including its ancestors up to `#storybook-root`) and `domTree`
 *   is the bounded subtree rooted at the anchor with the anchor node marked
 *   via `commentIds`. Only the anchor's subtree is captured — not the whole
 *   story root — to minimise AI agent context consumption.
 */
export const summarizeTarget = (
  options: SummarizeStoryOptions,
): SummarizeStoryResult => {
  const {
    anchor,
    commentId,
    maxDomDepth = DEFAULT_MAX_DOM_DEPTH,
    maxDomChildren = DEFAULT_MAX_DOM_CHILDREN,
    maxTextLength = DEFAULT_MAX_TEXT_LENGTH,
  } = options;

  const normalizeText = makeNormalizeText(maxTextLength);
  const target = summarizeElement(anchor, normalizeText);
  const domTree = buildDomTree(
    anchor,
    0,
    anchor,
    commentId,
    maxDomDepth,
    maxDomChildren,
    normalizeText,
  ) ?? {
    attributes: readAttributes(anchor),
    commentIds: [commentId],
    rect: toRect(anchor),
    selector: domPathFor(anchor),
    tagName: anchor.tagName.toLowerCase(),
    text: textFor(anchor, normalizeText),
  };

  return { domTree, target };
};

/**
 * IIFE entry point exposed on `window` when this module is injected via
 * page.addScriptTag in Playwright.
 */
if (
  typeof window !== "undefined" &&
  !("__canvasCommentsSummarizeTarget" in window)
) {
  (
    window as unknown as {
      __canvasCommentsSummarizeTarget: typeof summarizeTarget;
    }
  ).__canvasCommentsSummarizeTarget = summarizeTarget;
}
