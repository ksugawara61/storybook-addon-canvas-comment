import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { parseReviewState, readReviewStatus } from "../review-schema.ts";
import type { ReviewState, ReviewStatus } from "../types.ts";
import {
  type BoardFile,
  createEmptyBoardFile,
  parseBoardFile,
  serializeBoardFile,
} from "./board-schema.ts";
import {
  BOARD_FILE_RELATIVE_PATH,
  INSTRUCTIONS_FILE_RELATIVE_PATH,
} from "./constants.ts";
import { toInstructionsMarkdown } from "./instructions.ts";

export type BoardPaths = { board: string; instructions: string };

export const createBoardPaths = (cwd: string = process.cwd()): BoardPaths => ({
  board: resolve(cwd, BOARD_FILE_RELATIVE_PATH),
  instructions: resolve(cwd, INSTRUCTIONS_FILE_RELATIVE_PATH),
});

/** Paths for a given board.json. The instructions Markdown sits next to it. */
export const boardPathsFromFile = (boardFile: string): BoardPaths => {
  const board = resolve(boardFile);
  return { board, instructions: join(dirname(board), "board-instructions.md") };
};

const json = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as unknown) : undefined;
};

const readRaw = async (path: string): Promise<unknown> => {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
};

const readRawReview = (raw: unknown): unknown =>
  typeof raw === "object" && raw !== null && "review" in raw
    ? raw.review
    : undefined;

export const readBoardFile = async (path: string): Promise<BoardFile> => {
  const raw = await readRaw(path);
  return raw === undefined ? createEmptyBoardFile() : parseBoardFile(raw);
};

/** Reads the review status that board.json keeps next to the boards. */
export const readBoardReview = async (path: string): Promise<ReviewState> =>
  parseReviewState(readRawReview(await readRaw(path)));

const writeFiles = async (
  paths: BoardPaths,
  file: BoardFile,
  review: ReviewState,
): Promise<void> => {
  await fs.mkdir(dirname(paths.board), { recursive: true });
  await fs.mkdir(dirname(paths.instructions), { recursive: true });
  await Promise.all([
    fs.writeFile(paths.board, serializeBoardFile(file, review)),
    fs.writeFile(paths.instructions, toInstructionsMarkdown(file.boards)),
  ]);
};

/**
 * Writes board.json and a Markdown copy of the instructions that agents can read as-is.
 * The stored review status is kept, since the board page does not send it.
 */
export const writeBoardFile = async (
  paths: BoardPaths,
  file: BoardFile,
): Promise<void> => {
  await writeFiles(paths, file, await readBoardReview(paths.board));
};

export const writeBoardReview = async (
  paths: BoardPaths,
  status: ReviewStatus,
): Promise<ReviewState> => {
  const review: ReviewState = { status, updatedAt: new Date().toISOString() };
  await writeFiles(paths, await readBoardFile(paths.board), review);
  return review;
};

/** Handles `GET` / `PUT /__canvas-comments/board` on the dev server. */
export const handleBoardRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  paths: BoardPaths,
): Promise<void> => {
  switch (req.method) {
    case "GET": {
      json(res, 200, await readBoardFile(paths.board));
      return;
    }
    case "PUT": {
      const file = parseBoardFile(await readBody(req));
      await writeBoardFile(paths, file);
      json(res, 200, file);
      return;
    }
    default: {
      json(res, 405, { error: "Method not allowed" });
    }
  }
};

/** Handles `GET` / `POST /__canvas-comments/board/review` on the dev server. */
export const handleBoardReviewRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  paths: BoardPaths,
): Promise<void> => {
  switch (req.method) {
    case "GET": {
      json(res, 200, await readBoardReview(paths.board));
      return;
    }
    case "POST": {
      const status = readReviewStatus(await readBody(req));
      if (!status) {
        json(res, 400, { error: "Invalid review status payload" });
        return;
      }
      json(res, 200, await writeBoardReview(paths, status));
      return;
    }
    default: {
      json(res, 405, { error: "Method not allowed" });
    }
  }
};
