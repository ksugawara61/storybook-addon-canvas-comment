import type { CanvasComment, CanvasCommentStatus } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCanvasCommentStatus = (value: unknown): value is CanvasCommentStatus =>
  value === "open" || value === "resolved";

const isOptionalString = (value: unknown) =>
  value === undefined || typeof value === "string";

const isRect = (value: unknown): value is CanvasComment["rect"] =>
  isRecord(value) &&
  typeof value.x === "number" &&
  typeof value.y === "number" &&
  typeof value.width === "number" &&
  typeof value.height === "number";

const isPoint = (value: unknown): value is CanvasComment["pointer"] =>
  isRecord(value) && typeof value.x === "number" && typeof value.y === "number";

const isViewport = (value: unknown): value is CanvasComment["viewport"] =>
  isRecord(value) &&
  typeof value.width === "number" &&
  typeof value.height === "number";

export const isCanvasComment = (value: unknown): value is CanvasComment => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.storyId === "string" &&
    typeof value.storyTitle === "string" &&
    typeof value.storyName === "string" &&
    typeof value.note === "string" &&
    typeof value.selector === "string" &&
    isOptionalString(value.dataTestId) &&
    isOptionalString(value.dataAiComponent) &&
    isOptionalString(value.dataAiSource) &&
    isRect(value.rect) &&
    isPoint(value.pointer) &&
    isViewport(value.viewport) &&
    typeof value.createdAt === "string" &&
    isCanvasCommentStatus(value.status)
  );
};

export const readCanvasCommentStatus = (
  value: unknown,
): CanvasCommentStatus | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return isCanvasCommentStatus(value.status) ? value.status : undefined;
};
