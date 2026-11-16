import {
  type BoardFile,
  createEmptyBoardFile,
  parseBoardFile,
  serializeBoardFile,
} from "../board/board-schema.ts";
import {
  type InstructionItem,
  resolveInstructionItems,
} from "../board/board-items.ts";
import { parseReviewState } from "../review-schema.ts";
import type { ReviewState, ReviewStatus } from "../types.ts";
import { type R2BucketLike, R2JsonObject } from "./r2-object.ts";

type StoredBoard = { file: BoardFile; review: ReviewState };

const BOARD_CODEC = {
  empty: (): StoredBoard => ({
    file: createEmptyBoardFile(),
    review: parseReviewState(undefined),
  }),
  parse: (raw: unknown): StoredBoard => ({
    file: parseBoardFile(raw),
    review: parseReviewState(
      typeof raw === "object" && raw !== null && "review" in raw
        ? raw.review
        : undefined,
    ),
  }),
  serialize: ({ file, review }: StoredBoard): string =>
    serializeBoardFile(file, review),
};

/**
 * Stores the boards and their review status in one R2 object (`<app>/board.json`),
 * in the same format as the dev server's `board.json`.
 * Writes are conditional on its etag, see `R2JsonObject`.
 */
export class R2BoardStore {
  readonly #object: R2JsonObject<StoredBoard>;

  constructor(bucket: R2BucketLike, key: string) {
    this.#object = new R2JsonObject(bucket, key, BOARD_CODEC);
  }

  async readFile(): Promise<BoardFile> {
    return (await this.#object.read()).file;
  }

  /** Replaces the boards and keeps the review status, since the board page does not send it. */
  async writeFile(file: BoardFile): Promise<BoardFile> {
    return this.#object.mutate((stored) => ({
      next: { ...stored, file },
      result: file,
    }));
  }

  async readReview(): Promise<ReviewState> {
    return (await this.#object.read()).review;
  }

  async writeReview(status: ReviewStatus): Promise<ReviewState> {
    const review: ReviewState = { status, updatedAt: new Date().toISOString() };
    return this.#object.mutate((stored) => ({
      next: { ...stored, review },
      result: review,
    }));
  }

  /**
   * Removes applied instructions in one conditional write, so edits the board page
   * saved meanwhile are kept. Without `ids`, every instruction is removed.
   */
  async resolve(ids?: ReadonlySet<string>): Promise<InstructionItem[]> {
    return this.#object.mutate((stored) => {
      const { file, resolved } = resolveInstructionItems(stored.file, ids);
      return {
        next: resolved.length > 0 ? { ...stored, file } : null,
        result: resolved,
      };
    });
  }
}
