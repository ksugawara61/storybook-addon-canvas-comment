import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { REVIEW_STORAGE_RELATIVE_PATH } from "../constants.ts";
import { readReviewStatus } from "../review-schema.ts";
import type { ReviewState, ReviewStatus } from "../types.ts";

const DEFAULT_STATE: ReviewState = { status: "reviewing", updatedAt: null };

export class FsReviewStore {
  readonly #file: string;

  constructor(reviewStatusFile?: string) {
    this.#file =
      reviewStatusFile ?? resolve(process.cwd(), REVIEW_STORAGE_RELATIVE_PATH);
  }

  async read(): Promise<ReviewState> {
    try {
      const parsed = JSON.parse(
        await fs.readFile(this.#file, "utf8"),
      ) as unknown;
      const status = readReviewStatus(parsed);

      if (!status) {
        return DEFAULT_STATE;
      }

      const updatedAt =
        typeof (parsed as { updatedAt?: unknown }).updatedAt === "string"
          ? (parsed as { updatedAt: string }).updatedAt
          : null;

      return { status, updatedAt };
    } catch {
      return DEFAULT_STATE;
    }
  }

  async write(status: ReviewStatus): Promise<ReviewState> {
    const state: ReviewState = {
      status,
      updatedAt: new Date().toISOString(),
    };
    await fs.mkdir(dirname(this.#file), { recursive: true });
    await fs.writeFile(this.#file, `${JSON.stringify(state, null, 2)}\n`);
    return state;
  }
}
