import { describe, expect, it } from "vitest";
import type { Board, BoardFrame } from "../board-schema.ts";
import { fitViewport, pinchViewport } from "./viewport.ts";

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

  it("uses a smaller padding on a phone-sized container", () => {
    expect(fitViewport(createBoard([]), { height: 600, width: 384 })).toEqual({
      x: 32,
      y: 32,
      zoom: 1,
    });
  });
});

describe("pinchViewport", () => {
  const origin = { x: 10, y: 20, zoom: 1 };

  it("pans by the movement of the midpoint when the fingers keep their spread", () => {
    expect(
      pinchViewport(
        origin,
        [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
        ],
        [
          { x: 130, y: 140 },
          { x: 230, y: 140 },
        ],
      ),
    ).toEqual({ x: 40, y: 60, zoom: 1 });
  });

  it("zooms around the midpoint by the change in spread", () => {
    const result = pinchViewport(
      origin,
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      [
        { x: 50, y: 100 },
        { x: 250, y: 100 },
      ],
    );

    expect(result.zoom).toBe(2);
    // The board point under the midpoint (150, 100) stays there.
    expect((150 - result.x) / result.zoom).toBe((150 - origin.x) / origin.zoom);
    expect((100 - result.y) / result.zoom).toBe((100 - origin.y) / origin.zoom);
  });

  it("clamps the zoom", () => {
    expect(
      pinchViewport(
        origin,
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
      ).zoom,
    ).toBe(2);
  });
});
