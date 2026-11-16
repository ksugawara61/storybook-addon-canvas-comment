import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  boardPathsFromFile,
  readBoardReview,
  writeBoardFile,
  writeBoardReview,
} from "./api.ts";
import type { BoardFile } from "./board-schema.ts";
import { BoardWaitTimeoutError, waitForBoard } from "./board-watch.ts";

const boardFile: BoardFile = {
  boards: [
    {
      components: [],
      edits: [
        {
          createdAt: "",
          dx: 0,
          dy: 0,
          frameId: "frame-1",
          id: "edit-1",
          label: 'button "Save"',
          note: "Make it primary",
          remove: false,
          selector: "button",
        },
      ],
      frames: [
        {
          args: "",
          height: 720,
          id: "frame-1",
          label: "Primary",
          storyId: "button--primary",
          title: "Button / Primary",
          width: 390,
          x: 0,
          y: 0,
        },
      ],
      id: "board-1",
      name: "Buttons",
      notes: [],
      updatedAt: "",
    },
  ],
  version: 1,
};

const setup = async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), "canvas-comments-board-watch-"));
  const paths = boardPathsFromFile(join(dir, "board.json"));
  await writeBoardFile(paths, boardFile);
  return paths;
};

describe("waitForBoard", () => {
  it("resets a stale completed review, then returns the instructions once the board is sent", async () => {
    const paths = await setup();
    await writeBoardReview(paths, "completed");

    const waiting = waitForBoard(paths, {
      onWaiting: () => {
        void writeBoardReview(paths, "completed");
      },
      pollIntervalMs: 5,
      reset: true,
      timeoutMs: 0,
    });
    const handoff = await waiting;

    expect(handoff.items).toEqual([
      { boardId: "board-1", boardName: "Buttons", id: "edit-1", kind: "edit" },
    ]);
    expect(handoff.instructions).toContain(
      '1. button "Save" (`button`): Make it primary',
    );
  });

  it("returns at once for a completed review with --no-reset", async () => {
    const paths = await setup();
    await writeBoardReview(paths, "completed");

    const handoff = await waitForBoard(paths, {
      pollIntervalMs: 5,
      reset: false,
      timeoutMs: 0,
    });

    expect(handoff.boardFile).toBe(paths.board);
  });

  it("times out while the board is not sent", async () => {
    const paths = await setup();

    await expect(
      waitForBoard(paths, { pollIntervalMs: 5, reset: true, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(BoardWaitTimeoutError);
    expect((await readBoardReview(paths.board)).status).toBe("reviewing");
  });
});
