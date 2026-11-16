import { describe, expect, it } from "vitest";
import {
  listInstructionItems,
  readResolveRequest,
  resolveInstructionItems,
} from "./board-items.ts";
import type { Board, BoardFile } from "./board-schema.ts";

const board = (id: string, overrides: Partial<Board> = {}): Board => ({
  components: [],
  edits: [],
  frames: [],
  id,
  name: `Board ${id}`,
  notes: [],
  updatedAt: "2026-11-15T00:00:00.000Z",
  ...overrides,
});

const edit = (id: string) => ({
  createdAt: "",
  dx: 0,
  dy: 8,
  frameId: "frame-1",
  id,
  label: "button",
  note: "",
  remove: false,
  selector: "button",
});

const component = (id: string) => ({
  anchorLabel: "",
  anchorSelector: "",
  args: "",
  componentName: "Checkbox",
  createdAt: "",
  designSystem: "ui",
  frameId: "frame-1",
  height: 20,
  id,
  importPath: "@example/ui",
  note: "",
  refId: "",
  storyId: "ui-checkbox--default",
  storyName: "Default",
  width: 100,
  x: 0,
  y: 0,
});

const note = (id: string, body: string) => ({
  body,
  createdAt: "",
  id,
  x: 0,
  y: 0,
});

const file: BoardFile = {
  boards: [
    board("a", {
      components: [component("component-1")],
      edits: [edit("edit-1"), edit("edit-2")],
      notes: [note("note-1", "Ship it"), note("note-empty", "  ")],
    }),
    board("b", { edits: [edit("edit-3")] }),
  ],
  version: 1,
};

describe("listInstructionItems", () => {
  it("lists edits, components and notes with text, as the instructions do", () => {
    expect(listInstructionItems(file.boards)).toEqual([
      { boardId: "a", boardName: "Board a", id: "edit-1", kind: "edit" },
      { boardId: "a", boardName: "Board a", id: "edit-2", kind: "edit" },
      { boardId: "a", boardName: "Board a", id: "component-1", kind: "component" },
      { boardId: "a", boardName: "Board a", id: "note-1", kind: "note" },
      { boardId: "b", boardName: "Board b", id: "edit-3", kind: "edit" },
    ]);
  });
});

describe("resolveInstructionItems", () => {
  const now = "2026-11-16T00:00:00.000Z";

  it("removes only the given ids and touches only the boards they were on", () => {
    const result = resolveInstructionItems(
      file,
      new Set(["edit-1", "component-1", "note-1", "unknown"]),
      now,
    );

    expect(result.resolved.map((item) => item.id)).toEqual([
      "edit-1",
      "component-1",
      "note-1",
    ]);
    const [first, second] = result.file.boards;
    expect(first?.edits.map((item) => item.id)).toEqual(["edit-2"]);
    expect(first?.components).toEqual([]);
    expect(first?.notes.map((item) => item.id)).toEqual(["note-empty"]);
    expect(first?.updatedAt).toBe(now);
    expect(second).toBe(file.boards[1]);
  });

  it("removes every instruction without ids", () => {
    const result = resolveInstructionItems(file, undefined, now);

    expect(result.resolved).toHaveLength(5);
    expect(listInstructionItems(result.file.boards)).toEqual([]);
  });
});

describe("readResolveRequest", () => {
  it("reads ids", () => {
    expect(readResolveRequest({ ids: ["a", "b"] })).toEqual({
      ids: new Set(["a", "b"]),
    });
  });

  it("reads all", () => {
    expect(readResolveRequest({ all: true })).toEqual({});
  });

  it.each([
    undefined,
    null,
    {},
    { ids: [] },
    { ids: [""] },
    { ids: [1] },
    { all: false },
    { all: true, ids: ["a"] },
  ])("rejects %j, so a malformed body never clears the board", (body) => {
    expect(readResolveRequest(body)).toBeUndefined();
  });
});
