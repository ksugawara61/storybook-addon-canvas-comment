import type { ReviewState, ReviewStatus } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isReviewStatus = (value: unknown): value is ReviewStatus =>
  value === "reviewing" || value === "completed";

export const readReviewStatus = (value: unknown): ReviewStatus | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return isReviewStatus(value.status) ? value.status : undefined;
};

export const createInitialReviewState = (): ReviewState => ({
  status: "reviewing",
  updatedAt: null,
});

/** Reads a stored `review` field. Anything invalid reads as a review that has not completed. */
export const parseReviewState = (value: unknown): ReviewState => {
  const status = readReviewStatus(value);

  if (!status || !isRecord(value)) {
    return createInitialReviewState();
  }

  return {
    status,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
};
