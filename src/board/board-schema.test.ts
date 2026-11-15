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

const component = (frameId: string) => ({
  componentName: "Alert",
  designSystem: "Example UI",
  frameId,
  height: 64,
  id: `component-${frameId}`,
  importPath: "@example/ui",
  storyId: "ui-alert--warning",
  width: 320,
  x: 16,
  y: 120,
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

  it("loads a board saved before components existed", () => {
    const parsed = parseBoardFile({
      boards: [{ edits: [], frames: [frame], id: "board-1", name: "Old", notes: [] }],
      version: 1,
    });

    expect(parsed.boards[0]?.components).toEqual([]);
  });

  it("fills the optional component fields and drops components for missing frames", () => {
    const parsed = parseBoardFile({
      boards: [
        {
          components: [
            component("frame-1"),
            component("frame-removed"),
            { ...component("frame-1"), id: "broken", x: "16" },
          ],
          edits: [],
          frames: [frame],
          id: "board-1",
          name: "Compare",
          notes: [],
        },
      ],
      version: 1,
    });

    expect(parsed.boards[0]?.components).toEqual([
      {
        ...component("frame-1"),
        anchorLabel: "",
        anchorSelector: "",
        args: "",
        createdAt: "",
        note: "",
        refId: "",
        storyName: "",
      },
    ]);
  });
});
