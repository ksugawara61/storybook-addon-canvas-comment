import type {
  CanvasComment,
  CanvasCommentReply,
  CanvasCommentReplyAuthor,
  CanvasCommentStatus,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCanvasCommentStatus = (value: unknown): value is CanvasCommentStatus =>
  value === "open" || value === "resolved";

const isCanvasCommentReplyAuthor = (
  value: unknown,
): value is CanvasCommentReplyAuthor =>
  value === "reviewer" || value === "agent";

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

const isA11yNode = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  typeof value.role === "string" &&
  typeof value.name === "string";

const isOptionalA11yAnchor = (value: unknown) =>
  value === undefined ||
  (isA11yNode(value) &&
    Array.isArray(value.ancestors) &&
    value.ancestors.every(isA11yNode) &&
    typeof value.index === "number" &&
    isPoint(value.offset));

/**
 * Shallow validation for the optional domContext field.
 * Existing comments without domContext still pass (undefined is valid).
 */
const isOptionalDomContext = (
  value: unknown,
): value is CanvasComment["domContext"] => {
  if (value === undefined) {
    return true;
  }

  return (
    isRecord(value) &&
    typeof value.capturedAt === "string" &&
    isViewport(value.viewport) &&
    isRecord(value.target) &&
    isRecord(value.domTree) &&
    isOptionalA11yAnchor(value.a11yAnchor)
  );
};

const isCanvasCommentReply = (value: unknown): value is CanvasCommentReply =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isCanvasCommentReplyAuthor(value.author) &&
  typeof value.body === "string" &&
  typeof value.createdAt === "string";

// Comments saved before replies existed have no `replies` field.
const isOptionalReplies = (value: unknown) =>
  value === undefined ||
  (Array.isArray(value) && value.every(isCanvasCommentReply));

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
    isCanvasCommentStatus(value.status) &&
    isOptionalDomContext(value.domContext) &&
    isOptionalReplies(value.replies)
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

export type CanvasCommentReplyInput = Pick<
  CanvasCommentReply,
  "author" | "body"
>;

/** Reads a reply request payload. The body is trimmed and must not be empty. */
export const readCanvasCommentReplyInput = (
  value: unknown,
): CanvasCommentReplyInput | undefined => {
  if (
    !isRecord(value) ||
    !isCanvasCommentReplyAuthor(value.author) ||
    typeof value.body !== "string"
  ) {
    return undefined;
  }

  const body = value.body.trim();

  return body ? { author: value.author, body } : undefined;
};

export const createCanvasCommentReply = (
  input: CanvasCommentReplyInput,
): CanvasCommentReply => ({
  author: input.author,
  body: input.body,
  createdAt: new Date().toISOString(),
  id: crypto.randomUUID(),
});
