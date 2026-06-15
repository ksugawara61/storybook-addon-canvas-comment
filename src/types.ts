export type CanvasCommentStatus = "open" | "resolved";

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
