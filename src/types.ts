export type CanvasCommentStatus = "open" | "resolved";

export type ReviewStatus = "reviewing" | "completed";

export type ReviewState = {
  status: ReviewStatus;
  updatedAt: string | null;
};

export type CanvasCommentRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasCommentPoint = {
  x: number;
  y: number;
};

export type CanvasCommentViewport = {
  width: number;
  height: number;
};

export type CanvasCommentA11yNode = {
  /** Computed accessible name, e.g. "Save". */
  name: string;
  /** Explicit or implicit ARIA role, e.g. "button". */
  role: string;
};

/**
 * Locates the commented element through the accessibility tree instead of
 * absolute coordinates, so the anchor survives layout changes.
 */
export type CanvasCommentA11yAnchor = CanvasCommentA11yNode & {
  /** Nearest named ancestors (role + name), outermost first. */
  ancestors: CanvasCommentA11yNode[];
  /** Position among elements matching the same role, name, and ancestors. */
  index: number;
  /** Comment position inside the element's box as a 0–1 ratio. */
  offset: CanvasCommentPoint;
};

export type DomElementSummary = {
  ancestors: Array<{
    attributes: Record<string, string>;
    selector: string;
    tagName: string;
  }>;
  ariaLabel?: string;
  attributes: Record<string, string>;
  domPath: string;
  rect: CanvasCommentRect;
  role?: string;
  selector: string;
  tagName: string;
  text?: string;
};

export type DomTreeNode = {
  attributes: Record<string, string>;
  children?: DomTreeNode[];
  commentIds: string[];
  rect: CanvasCommentRect;
  selector: string;
  tagName: string;
  text?: string;
  truncatedChildren?: number;
};

export type CanvasCommentDomContext = {
  a11yAnchor?: CanvasCommentA11yAnchor;
  capturedAt: string;
  domTree: DomTreeNode;
  target: DomElementSummary;
  viewport: CanvasCommentViewport;
};

export type CanvasComment = {
  id: string;
  storyId: string;
  storyTitle: string;
  storyName: string;
  note: string;
  selector: string;
  dataTestId?: string;
  dataAiComponent?: string;
  dataAiSource?: string;
  rect: CanvasCommentRect;
  pointer: CanvasCommentPoint;
  viewport: CanvasCommentViewport;
  createdAt: string;
  status: CanvasCommentStatus;
  domContext?: CanvasCommentDomContext;
};
