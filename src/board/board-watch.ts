import {
  type BoardPaths,
  readBoardFile,
  readBoardReview,
  writeBoardReview,
} from "./api.ts";
import { type InstructionItem, listInstructionItems } from "./board-items.ts";
import { toInstructionsMarkdown } from "./instructions.ts";

export type BoardHandoff = {
  boardFile: string;
  /** The same Markdown as board-instructions.md, built from board.json when the review completed. */
  instructions: string;
  /** The ids to pass to `canvas-comments-board-resolve --ids` once they are applied. */
  items: InstructionItem[];
};

export class BoardWaitTimeoutError extends Error {}

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
  paths: BoardPaths,
): Promise<BoardHandoff> => {
  const file = await readBoardFile(paths.board);
  return {
    boardFile: paths.board,
    instructions: toInstructionsMarkdown(file.boards),
    items: listInstructionItems(file.boards),
  };
};

/** Polls board.json until the board page sends the board to the agent ("Send to agent"). */
export const waitForBoard = async (
  paths: BoardPaths,
  options: WaitForBoardOptions,
): Promise<BoardHandoff> => {
  if (options.reset) {
    await writeBoardReview(paths, "reviewing");
  }
  options.onWaiting?.();
  const startedAt = Date.now();
  while (true) {
    if ((await readBoardReview(paths.board)).status === "completed") {
      return readBoardHandoff(paths);
    }
    if (options.timeoutMs > 0 && Date.now() - startedAt >= options.timeoutMs) {
      throw new BoardWaitTimeoutError(
        `Timed out after ${options.timeoutMs}ms waiting for the board.`,
      );
    }
    await delay(options.pollIntervalMs);
  }
};
