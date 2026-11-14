import type { ReviewState, ReviewStatus } from "../types.ts";
import {
  readCommentsFile,
  resolveCommentsFile,
  writeCommentsFile,
} from "./fs-adapter.ts";

/** Reads and writes the `review` field of comments.json. */
export class FsReviewStore {
  readonly #file: string;

  constructor(commentsFile?: string) {
    this.#file = resolveCommentsFile(commentsFile);
  }

  async read(): Promise<ReviewState> {
    return (await readCommentsFile(this.#file)).review;
  }

  async write(status: ReviewStatus): Promise<ReviewState> {
    const review: ReviewState = { status, updatedAt: new Date().toISOString() };
    const current = await readCommentsFile(this.#file);
    await writeCommentsFile(this.#file, { ...current, review });
    return review;
  }
}
