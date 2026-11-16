import type {
  CanvasComment,
  CanvasCommentReply,
  CanvasCommentStatus,
  ReviewState,
  ReviewStatus,
} from "../types.ts";
import {
  type CommentsFile,
  createEmptyCommentsFile,
  parseCommentsFile,
  serializeCommentsFile,
} from "./comments-file.ts";
import { type R2BucketLike, R2JsonObject } from "./r2-object.ts";
import type { StorageAdapter } from "./types.ts";

export type { R2BucketLike } from "./r2-object.ts";

const COMMENTS_CODEC = {
  empty: createEmptyCommentsFile,
  parse: parseCommentsFile,
  serialize: serializeCommentsFile,
};

/**
 * Stores comments and the review status in one R2 object (`<app>/comments.json`).
 * Writes are conditional on its etag, see `R2JsonObject`.
 */
export class R2Adapter implements StorageAdapter {
  readonly #object: R2JsonObject<CommentsFile>;

  constructor(bucket: R2BucketLike, key: string) {
    this.#object = new R2JsonObject(bucket, key, COMMENTS_CODEC);
  }

  async list(): Promise<CanvasComment[]> {
    return (await this.#object.read()).comments;
  }

  async create(comment: CanvasComment): Promise<CanvasComment> {
    return this.#object.mutate((file) => ({
      next: { ...file, comments: [comment, ...file.comments] },
      result: comment,
    }));
  }

  async updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null> {
    return this.#object.mutate((file) => {
      const comments = file.comments.map((c) =>
        c.id === id ? { ...c, status } : c,
      );
      const found = comments.find((c) => c.id === id) ?? null;
      return { next: found ? { ...file, comments } : null, result: found };
    });
  }

  async addReply(
    id: string,
    reply: CanvasCommentReply,
  ): Promise<CanvasComment | null> {
    return this.#object.mutate((file) => {
      const comments = file.comments.map((c) =>
        c.id === id ? { ...c, replies: [...(c.replies ?? []), reply] } : c,
      );
      const found = comments.find((c) => c.id === id) ?? null;
      return { next: found ? { ...file, comments } : null, result: found };
    });
  }

  async remove(id: string): Promise<CanvasComment | null> {
    return this.#object.mutate((file) => {
      const deleted = file.comments.find((c) => c.id === id) ?? null;
      return {
        next: deleted
          ? { ...file, comments: file.comments.filter((c) => c.id !== id) }
          : null,
        result: deleted,
      };
    });
  }

  async removeResolved(): Promise<CanvasComment[]> {
    return this.#object.mutate((file) => {
      const deleted = file.comments.filter((c) => c.status === "resolved");
      return {
        next:
          deleted.length > 0
            ? {
                ...file,
                comments: file.comments.filter((c) => c.status !== "resolved"),
              }
            : null,
        result: deleted,
      };
    });
  }

  async readReviewState(): Promise<ReviewState> {
    return (await this.#object.read()).review;
  }

  async writeReviewState(status: ReviewStatus): Promise<ReviewState> {
    const review: ReviewState = { status, updatedAt: new Date().toISOString() };
    return this.#object.mutate((file) => ({
      next: { ...file, review },
      result: review,
    }));
  }
}
