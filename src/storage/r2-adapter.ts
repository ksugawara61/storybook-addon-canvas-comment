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
import type { StorageAdapter } from "./types.ts";

/** The subset of Cloudflare's `R2Bucket` this adapter uses, so Node code can type it too. */
export type R2BucketLike = {
  get(key: string): Promise<{ etag: string; text(): Promise<string> } | null>;
  /** Resolves to null when the `onlyIf` precondition fails. */
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: { contentType?: string };
      onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string };
    },
  ): Promise<unknown>;
};

const MAX_ATTEMPTS = 8;

type Change<T> = { next: CommentsFile | null; result: T };

/**
 * Stores everything in one R2 object. Every write is conditional on the etag it
 * read, so a concurrent writer makes it re-read and retry instead of losing data.
 */
export class R2Adapter implements StorageAdapter {
  readonly #bucket: R2BucketLike;
  readonly #key: string;

  constructor(bucket: R2BucketLike, key: string) {
    this.#bucket = bucket;
    this.#key = key;
  }

  async list(): Promise<CanvasComment[]> {
    return (await this.#load()).file.comments;
  }

  async create(comment: CanvasComment): Promise<CanvasComment> {
    return this.#mutate((file) => ({
      next: { ...file, comments: [comment, ...file.comments] },
      result: comment,
    }));
  }

  async updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null> {
    return this.#mutate((file) => {
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
    return this.#mutate((file) => {
      const comments = file.comments.map((c) =>
        c.id === id ? { ...c, replies: [...(c.replies ?? []), reply] } : c,
      );
      const found = comments.find((c) => c.id === id) ?? null;
      return { next: found ? { ...file, comments } : null, result: found };
    });
  }

  async remove(id: string): Promise<CanvasComment | null> {
    return this.#mutate((file) => {
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
    return this.#mutate((file) => {
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
    return (await this.#load()).file.review;
  }

  async writeReviewState(status: ReviewStatus): Promise<ReviewState> {
    const review: ReviewState = { status, updatedAt: new Date().toISOString() };
    return this.#mutate((file) => ({
      next: { ...file, review },
      result: review,
    }));
  }

  async #load(): Promise<{ etag: string | null; file: CommentsFile }> {
    const object = await this.#bucket.get(this.#key);

    if (!object) {
      return { etag: null, file: createEmptyCommentsFile() };
    }

    return {
      etag: object.etag,
      file: parseCommentsFile(JSON.parse(await object.text())),
    };
  }

  async #mutate<T>(change: (file: CommentsFile) => Change<T>): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const { etag, file } = await this.#load();
      const { next, result } = change(file);

      if (!next) {
        return result;
      }

      const stored = await this.#bucket.put(
        this.#key,
        serializeCommentsFile(next),
        {
          httpMetadata: { contentType: "application/json" },
          // A missing object may only be created if nobody created it meanwhile.
          onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
        },
      );

      if (stored) {
        return result;
      }
    }

    throw new Error(
      `Could not save ${this.#key}: it kept changing during ${MAX_ATTEMPTS} attempts.`,
    );
  }
}
