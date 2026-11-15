import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
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

export const readBoardFile = async (path: string): Promise<BoardFile> => {
  try {
    return parseBoardFile(JSON.parse(await fs.readFile(path, "utf8")));
  } catch {
    return createEmptyBoardFile();
  }
};

/** Writes board.json and a Markdown copy of the instructions that agents can read as-is. */
export const writeBoardFile = async (
  paths: BoardPaths,
  file: BoardFile,
): Promise<void> => {
  await fs.mkdir(dirname(paths.board), { recursive: true });
  await fs.mkdir(dirname(paths.instructions), { recursive: true });
  await Promise.all([
    fs.writeFile(paths.board, serializeBoardFile(file)),
    fs.writeFile(paths.instructions, toInstructionsMarkdown(file.boards)),
  ]);
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
