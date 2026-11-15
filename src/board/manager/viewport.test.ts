import { describe, expect, it } from "vitest";
import type { Board, BoardFrame } from "../board-schema.ts";
import { fitViewport } from "./viewport.ts";

const createFrame = (overrides?: Partial<BoardFrame>): BoardFrame => ({
  args: "",
  height: 720,
  id: "frame-1",
  label: "Primary",
  storyId: "buttons-button--primary",
  title: "Button / Primary",
  width: 390,
  x: 0,
  y: 0,
  ...overrides,
});

const createBoard = (frames: BoardFrame[]): Board => ({
  components: [],
  edits: [],
  frames,
  id: "board-1",
  name: "Compare",
  notes: [],
  updatedAt: "",
});

describe("fitViewport", () => {
  it("keeps 100% zoom at the padding when the board is empty", () => {
    expect(fitViewport(createBoard([]), { height: 800, width: 1200 })).toEqual({
      x: 64,
      y: 64,
      zoom: 1,
    });
  });

  it("centers small content at 100% instead of zooming in", () => {
    // Centers a 390×752 box: the frame plus its 32px header above it
    expect(
      fitViewport(createBoard([createFrame()]), { height: 2000, width: 2000 }),
    ).toEqual({ x: 805, y: 656, zoom: 1 });
  });

  it("zooms out by the tighter of the width and height ratios", () => {
    const board = createBoard([
      createFrame(),
      createFrame({ id: "frame-2", width: 390, x: 3610 }),
    ]);

    expect(fitViewport(board, { height: 2000, width: 1000 }).zoom).toBeCloseTo(
      (1000 - 128) / 4000,
    );
  });
});
