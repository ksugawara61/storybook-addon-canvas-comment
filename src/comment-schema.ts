import type { CanvasComment, CanvasCommentStatus } from "./types";

export function isCanvasComment(value: unknown): value is CanvasComment {
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
}

export function readCanvasCommentStatus(
  value: unknown,
): CanvasCommentStatus | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return isCanvasCommentStatus(value.status) ? value.status : undefined;
}

function isCanvasCommentStatus(value: unknown): value is CanvasCommentStatus {
  return value === "open" || value === "resolved";
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isRect(value: unknown): value is CanvasComment["rect"] {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isPoint(value: unknown): value is CanvasComment["pointer"] {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isViewport(value: unknown): value is CanvasComment["viewport"] {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
