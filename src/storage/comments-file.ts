import { isCanvasComment } from "../comment-schema.ts";
import {
  createInitialReviewState,
  parseReviewState,
} from "../review-schema.ts";
import type { CanvasComment, ReviewState } from "../types.ts";

/**
 * The single stored document: the local `comments.json` and the hosted
 * R2 object `<app>/comments.json` share this shape.
 */
export type CommentsFile = {
  comments: CanvasComment[];
  review: ReviewState;
};

export const createEmptyCommentsFile = (): CommentsFile => ({
  comments: [],
  review: createInitialReviewState(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseComments = (value: unknown): CanvasComment[] =>
  Array.isArray(value) ? value.filter(isCanvasComment) : [];

/**
 * Reads an already JSON-parsed value. The legacy format, a bare comment array,
 * is accepted and gets the default review state. Anything else yields an empty file.
 */
export const parseCommentsFile = (raw: unknown): CommentsFile => {
  if (Array.isArray(raw)) {
    return { ...createEmptyCommentsFile(), comments: parseComments(raw) };
  }

  if (!isRecord(raw)) {
    return createEmptyCommentsFile();
  }

  return {
    comments: parseComments(raw.comments),
    review: parseReviewState(raw.review),
  };
};

export const serializeCommentsFile = (file: CommentsFile): string =>
  `${JSON.stringify({ comments: file.comments, review: file.review }, null, 2)}\n`;
