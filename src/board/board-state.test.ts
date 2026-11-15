import { describe, expect, it } from "vitest";
import type { Board } from "./board-schema.ts";
import {
  addFrame,
  createBoard,
  duplicateFrame,
  upsertElementEdit,
} from "./board-state.ts";
import { FRAME_GAP } from "./constants.ts";

const story = { storyId: "buttons-button--primary", title: "Button / Primary" };

const boardWithFrame = (): Board => addFrame(createBoard("Compare"), story);

const firstFrameId = (board: Board): string => {
  const frame = board.frames[0];
  if (!frame) {
    throw new Error("frame not found");
  }
  return frame.id;
};

describe("addFrame", () => {
  it("places a new frame to the right of the existing frames", () => {
    const board = addFrame(boardWithFrame(), story);

    expect(board.frames.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 390 + FRAME_GAP, y: 0 },
    ]);
  });
});

describe("duplicateFrame", () => {
  it("copies the instructions and keeps the source frame's instructions", () => {
    const base = boardWithFrame();
    const frameId = firstFrameId(base);
    const { board } = upsertElementEdit(
      base,
      { frameId, label: 'button "Save"', selector: "#root > button" },
      { dx: 8, dy: 0 },
    );

    const duplicated = duplicateFrame(board, frameId);
    const copy = duplicated.frames[1];

    expect(duplicated.edits).toEqual([
      expect.objectContaining({ dx: 8, frameId }),
      expect.objectContaining({ dx: 8, frameId: copy?.id }),
    ]);
  });
});

describe("upsertElementEdit", () => {
  it("merges moves of the same element into one instruction", () => {
    const base = boardWithFrame();
    const target = {
      frameId: firstFrameId(base),
      label: "button",
      selector: "#root > button",
    };

    const first = upsertElementEdit(base, target, { dx: 10, dy: -4 });
    const second = upsertElementEdit(first.board, target, { dx: 5, dy: 6 });

    expect(second.board.edits).toEqual([
      expect.objectContaining({ dx: 15, dy: 2, id: first.edit.id }),
    ]);
  });

  it("adds the same selector in another frame as a separate instruction", () => {
    const base = addFrame(boardWithFrame(), story);
    const [left, right] = base.frames;
    const selector = "#root > button";

    const first = upsertElementEdit(
      base,
      { frameId: left?.id ?? "", label: "button", selector },
      { dx: 1, dy: 0 },
    );
    const second = upsertElementEdit(
      first.board,
      { frameId: right?.id ?? "", label: "button", selector },
      { dx: 2, dy: 0 },
    );

    expect(second.board.edits.map((edit) => edit.dx)).toEqual([1, 2]);
  });
});
