import type { ReviewState, ReviewStatus } from "../types.ts";
import {
  type BoardPaths,
  readBoardFile,
  readBoardReview,
  writeBoardFile,
  writeBoardReview,
} from "./api.ts";
import type { BoardFile } from "./board-schema.ts";
import {
  type InstructionItem,
  listInstructionItems,
  resolveInstructionItems,
} from "./board-items.ts";
import { toInstructionsMarkdown } from "./instructions.ts";

/** Where the board CLIs read and write the board: a local board.json, or a hosted board API. */
export type BoardSource = {
  /** board.json's path, or the hosted board API's URL. */
  location: string;
  readFile(): Promise<BoardFile>;
  readReview(): Promise<ReviewState>;
  writeReview(status: ReviewStatus): Promise<ReviewState>;
  /** Removes applied instructions and returns them. Without `ids`, every instruction is removed. */
  resolve(ids?: ReadonlySet<string>): Promise<InstructionItem[]>;
};

/** The board.json the dev server writes. Writing it rewrites board-instructions.md too. */
export const fsBoardSource = (paths: BoardPaths): BoardSource => ({
  location: paths.board,
  readFile: () => readBoardFile(paths.board),
  readReview: () => readBoardReview(paths.board),
  resolve: async (ids) => {
    const { file, resolved } = resolveInstructionItems(
      await readBoardFile(paths.board),
      ids,
    );
    if (resolved.length > 0) {
      await writeBoardFile(paths, file);
    }
    return resolved;
  },
  writeReview: (status) => writeBoardReview(paths, status),
});

export type BoardHandoff = {
  /** Where the board was read from: board.json's path, or the hosted board API's URL. */
  boardFile: string;
  /** The same Markdown as board-instructions.md, built from board.json when the review completed. */
  instructions: string;
  /** The ids to pass to `canvas-comments-board-resolve --ids` once they are applied. */
  items: InstructionItem[];
};

export class BoardWaitTimeoutError extends Error {}

const MAX_CONSECUTIVE_FAILURES = 5;

export type WaitForBoardOptions = {
  pollIntervalMs: number;
  /** Resets the review to `reviewing` first, so a `completed` from a previous round is not picked up. */
  reset: boolean;
  /** 0 waits indefinitely. */
  timeoutMs: number;
  onWaiting?: () => void;
};

const delay = (ms: number) =>
  new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });

export const readBoardHandoff = async (
  source: BoardSource,
): Promise<BoardHandoff> => {
  const file = await source.readFile();
  return {
    boardFile: source.location,
    instructions: toInstructionsMarkdown(file.boards),
    items: listInstructionItems(file.boards),
  };
};

/** Polls the board until the board page sends it to the agent ("Send to agent"). */
export const waitForBoard = async (
  source: BoardSource,
  options: WaitForBoardOptions,
): Promise<BoardHandoff> => {
  if (options.reset) {
    await source.writeReview("reviewing");
  }
  options.onWaiting?.();
  const startedAt = Date.now();
  let failures = 0;
  while (true) {
    const review = await source.readReview().then(
      (state) => {
        failures = 0;
        return state;
      },
      (error: unknown) => {
        // A hosted API can fail for a moment during a long wait; give up only when it keeps failing.
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          throw error;
        }
        return undefined;
      },
    );
    if (review?.status === "completed") {
      return readBoardHandoff(source);
    }
    if (options.timeoutMs > 0 && Date.now() - startedAt >= options.timeoutMs) {
      throw new BoardWaitTimeoutError(
        `Timed out after ${options.timeoutMs}ms waiting for the board.`,
      );
    }
    await delay(options.pollIntervalMs);
  }
};
