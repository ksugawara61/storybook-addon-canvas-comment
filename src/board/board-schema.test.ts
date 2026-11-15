import { describe, expect, it } from "vitest";
import { createEmptyBoardFile, parseBoardFile } from "./board-schema.ts";

const frame = {
  args: "",
  height: 720,
  id: "frame-1",
  label: "Primary",
  storyId: "buttons-button--primary",
  title: "Button / Primary",
  width: 390,
  x: 0,
  y: 0,
};

const edit = (frameId: string) => ({
  createdAt: "2026-11-15T00:00:00.000Z",
  dx: 8,
  dy: 0,
  frameId,
  id: `edit-${frameId}`,
  label: "button",
  note: "",
  selector: "#root > button",
});

describe("parseBoardFile", () => {
  it.each([
    ["null", null],
    ["an array", []],
    ["an object without boards", { version: 1 }],
  ])("treats %s as an empty file", (_, raw) => {
    expect(parseBoardFile(raw)).toEqual(createEmptyBoardFile());
  });

  it("drops broken frames and instructions for missing frames", () => {
    const parsed = parseBoardFile({
      boards: [
        {
          edits: [edit("frame-1"), edit("frame-removed")],
          frames: [frame, { ...frame, id: "broken", width: "390" }],
          id: "board-1",
          name: "Compare",
          notes: [],
        },
      ],
      version: 1,
    });

    expect(parsed.boards[0]).toMatchObject({
      edits: [{ frameId: "frame-1" }],
      frames: [{ id: "frame-1" }],
    });
  });
});
