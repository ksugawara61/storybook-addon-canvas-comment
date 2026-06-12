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
};
