import { describe, expect, it } from "vitest";
import type {
  Board,
  BoardFrame,
  BoardNote,
  ComponentPlacement,
  ElementEdit,
} from "./board-schema.ts";
import { toInstructionsMarkdown } from "./instructions.ts";

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

const createEdit = (overrides?: Partial<ElementEdit>): ElementEdit => ({
  createdAt: "2026-11-15T00:00:00.000Z",
  dx: 0,
  dy: 0,
  frameId: "frame-1",
  id: "edit-1",
  label: 'button "Save"',
  note: "",
  selector: "#storybook-root > button",
  ...overrides,
});

const createNote = (overrides?: Partial<BoardNote>): BoardNote => ({
  body: "",
  createdAt: "2026-11-15T00:00:00.000Z",
  id: "note-1",
  x: 0,
  y: 0,
  ...overrides,
});

const createComponent = (
  overrides?: Partial<ComponentPlacement>,
): ComponentPlacement => ({
  anchorLabel: "",
  anchorSelector: "",
  args: "",
  componentName: "Alert",
  createdAt: "2026-11-15T00:00:00.000Z",
  designSystem: "Example UI",
  frameId: "frame-1",
  height: 64,
  id: "component-1",
  importPath: "@example/ui",
  note: "",
  refId: "",
  storyId: "ui-alert--warning",
  storyName: "Warning",
  width: 320,
  x: 16,
  y: 120,
  ...overrides,
});

const createBoard = (overrides?: Partial<Board>): Board => ({
  components: [],
  edits: [],
  frames: [createFrame()],
  id: "board-1",
  name: "Buttons",
  notes: [],
  updatedAt: "",
  ...overrides,
});

describe("toInstructionsMarkdown", () => {
  it.each([
    { dx: 12, dy: 0, expected: "move right 12px" },
    { dx: -4, dy: 8, expected: "move left 4px, move down 8px" },
    { dx: 0, dy: -16, expected: "move up 16px" },
  ])("writes the move ($dx, $dy) as \"$expected\"", ({ dx, dy, expected }) => {
    const markdown = toInstructionsMarkdown([
      createBoard({ edits: [createEdit({ dx, dy })] }),
    ]);

    expect(markdown).toContain(
      `1. button "Save" (\`#storybook-root > button\`): ${expected}`,
    );
  });

  it("writes only the comment for an instruction without a move", () => {
    const markdown = toInstructionsMarkdown([
      createBoard({ edits: [createEdit({ note: "Change the label to \"Save draft\"" })] }),
    ]);

    expect(markdown).toContain(': Change the label to "Save draft"');
  });

  it("writes a note on a frame under that frame, and other notes under the board", () => {
    const markdown = toInstructionsMarkdown([
      createBoard({
        notes: [
          createNote({ body: "The padding is too tight", x: 100, y: 100 }),
          createNote({ body: "Too dark overall", id: "note-2", x: 2000 }),
        ],
      }),
    ]);

    expect(markdown).toContain("- size: 390×720\n\n- Note: The padding is too tight");
    expect(markdown).toContain("### Board notes\n\n- Too dark overall");
  });

  it("writes a placed component with its import, story, position and the element it was dropped on", () => {
    const markdown = toInstructionsMarkdown([
      createBoard({
        components: [
          createComponent({
            anchorLabel: 'button "Save"',
            anchorSelector: "#storybook-root > button",
            args: "title:Check the form",
            note: "Show it above the button",
          }),
        ],
      }),
    ]);

    expect(markdown).toContain(
      [
        "- size: 390×720",
        "",
        "Components to add:",
        "",
        '- Add `Alert` (`import { Alert } from "@example/ui"`, as in story `ui-alert--warning`, args `title:Check the form`) at x 16px, y 120px, 320×64, over button "Save" (`#storybook-root > button`) / Show it above the button',
      ].join("\n"),
    );
  });

  it("lists element instructions before the components to add", () => {
    const markdown = toInstructionsMarkdown([
      createBoard({
        components: [createComponent()],
        edits: [createEdit({ dx: 12 })],
      }),
    ]);

    expect(markdown).toContain(
      '1. button "Save" (`#storybook-root > button`): move right 12px\n\nComponents to add:\n\n- Add `Alert`',
    );
  });

  it("says so when the board has no instructions or notes", () => {
    expect(toInstructionsMarkdown([createBoard()])).toContain(
      "No instructions.",
    );
  });
});
