import type { ReviewStatus } from "./types";

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
